/*
 * Fieldwatch ESP32-CAM Live Video Stream (AI Thinker ESP32-CAM - Hardened)
 *
 * Serves MJPEG video stream at: http://<ESP32-CAM-IP>/stream
 * Compatible with Fieldwatch YOLO vision daemon and web browser view.
 *
 * Board setting in Arduino IDE: "AI Thinker ESP32-CAM"
 */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// Include local gitignored credentials if available
#if __has_include("secrets.h")
#include "secrets.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID "YOUR_FIELD_WIFI_SSID"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "YOUR_FIELD_WIFI_PASSWORD"
#endif

const char *ssid = WIFI_SSID;
const char *password = WIFI_PASSWORD;

// AI Thinker ESP32-CAM OV2640 pin definitions
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

#define STREAM_BOUNDARY "123456789000000000000987654321"
static const char *STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" STREAM_BOUNDARY;
static const char *STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";
static const char *STREAM_DELIMITER = "\r\n--" STREAM_BOUNDARY "\r\n";

static esp_err_t streamHandler(httpd_req_t *request) {
  esp_err_t result = httpd_resp_set_type(request, STREAM_CONTENT_TYPE);
  if (result != ESP_OK) return result;

  while (true) {
    camera_fb_t *frame = esp_camera_fb_get();
    if (!frame) {
      delay(20);
      continue;
    }

    char header[64];
    const size_t headerLength = snprintf(header, sizeof(header), STREAM_PART, frame->len);

    result = httpd_resp_send_chunk(request, STREAM_DELIMITER, strlen(STREAM_DELIMITER));
    if (result == ESP_OK) {
      result = httpd_resp_send_chunk(request, header, headerLength);
    }
    if (result == ESP_OK) {
      result = httpd_resp_send_chunk(request, reinterpret_cast<const char *>(frame->buf), frame->len);
    }

    // Always release frame buffer back to camera driver immediately
    esp_camera_fb_return(frame);

    // If client disconnected or socket errored, exit loop cleanly
    if (result != ESP_OK) {
      break;
    }

    // Yield to prevent watchdog starvation and regulate frame rate (~25 fps)
    delay(40);
  }

  return result;
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.ctrl_port = 32768;
  config.max_open_sockets = 4;
  config.recv_wait_timeout = 5;
  config.send_wait_timeout = 5;

  httpd_handle_t server = nullptr;
  if (httpd_start(&server, &config) != ESP_OK) {
    Serial.println("[Camera] Web server failed to start");
    return;
  }

  httpd_uri_t streamUri = {};
  streamUri.uri = "/stream";
  streamUri.method = HTTP_GET;
  streamUri.handler = streamHandler;
  streamUri.user_ctx = nullptr;
  httpd_register_uri_handler(server, &streamUri);
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 15;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  const esp_err_t cameraStatus = esp_camera_init(&config);
  if (cameraStatus != ESP_OK) {
    Serial.printf("[Camera] Init failed with error code: 0x%x\n", cameraStatus);
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[WiFi] Connecting to camera station network...");

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 10000) {
    delay(300);
    Serial.print('.');
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[WiFi] Connected! Stream URL: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/stream");
  } else {
    Serial.println("\n[WiFi] Connection pending; retrying in background.");
  }

  startCameraServer();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnect = 0;
    if (millis() - lastReconnect > 15000) {
      lastReconnect = millis();
      WiFi.reconnect();
    }
  }
  delay(5000);
}
