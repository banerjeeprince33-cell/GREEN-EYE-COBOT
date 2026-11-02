#!/usr/bin/env python3
"""
Fieldwatch Ultrasonic Sensor 180° Radar Bridge
-----------------------------------------------
Backward-compatibility entrypoint. Delegates execution to hardware_iot/bridge/ultrasonic_bridge.py.
"""
import os
import sys
import runpy

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    bridge_path = os.path.join(current_dir, "bridge", "ultrasonic_bridge.py")
    if not os.path.exists(bridge_path):
        print(f"[Error] Bridge script not found at {bridge_path}")
        sys.exit(1)
    runpy.run_path(bridge_path, run_name="__main__")
