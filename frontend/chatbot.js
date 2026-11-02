// ==========================================================================
// FIELDWATCH RANGER AI - TACTICAL FIELD COPILOT & WILDLIFE ENCYCLOPEDIA
// Master Intelligence on Jungle Ecosystems, Zoology, Bushcraft & Console
// ==========================================================================

(function initRangerAICopilot() {
  'use strict';

  // State Management (Text-only interaction, speech synthesis disabled)
  const state = {
    isOpen: false,
    isMinimized: false,
    isSpeaking: false,
    isListening: false,
    soundEnabled: false,
    history: [],
    recognition: null,
    unreadCount: 0
  };

  const API_ENDPOINT = (typeof window !== 'undefined' && (window.location?.port === '3000' || window.location?.port === ''))
    ? '/api/ai/chat'
    : 'http://localhost:3000/api/ai/chat';

  // Safe HTML entity escaper for chatbot rendering
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ==========================================================================
  // MASTER SPECIES ENCYCLOPEDIA (OFFLINE ZOOLOGICAL DATABASE)
  // ==========================================================================
  const WILDLIFE_SPECIES = [
    {
      id: 'tiger',
      aliases: ['tiger', 'bengal tiger', 'panthera tigris', 'tigers', 'bagh', 'sher'],
      name: 'Bengal Tiger (Panthera tigris)',
      iucn: 'Endangered (Schedule I, WPA 1972)',
      threatLevel: 'CRITICAL',
      habitat: 'Mangroves (Sundarbans), moist deciduous (Corbett, Kanha), dry deciduous (Ranthambore), Terai grasslands.',
      diet: 'Apex hypercarnivore. Primary prey: Sambar, Chital (spotted deer), Wild Boar, Gaur, Nilgai.',
      speed: '49–65 km/h in short predatory bursts.',
      weight: 'Males: 180–260 kg; Females: 100–160 kg.',
      facts: [
        'Stripes are unique like human fingerprints; no two tigers have the same pattern.',
        'Unlike most cats, tigers love water, swim miles across broad rivers, and cool off in jungle waterholes.',
        'Night vision is 6 times sharper than a human\'s due to a highly reflective tapetum lucidum.',
        'A tiger\'s roar can be heard over 3 km (1.8 miles) away through dense forest.'
      ],
      sop: [
        'DO NOT RUN or turn your back — running triggers an immediate predatory ambush reflex.',
        'Stand tall, raise your arms or jacket to appear larger, and maintain eye contact.',
        'Back away steadily and slowly while speaking in a deep, firm voice (do not scream).',
        'Trigger the high-decibel acoustic deterrence siren and notify Forest Division Beat 04 immediately.'
      ],
      chips: ['Tiger Safety SOP', 'Pugmark Identification', 'Sound Alarm', 'Predator Status']
    },
    {
      id: 'leopard',
      aliases: ['leopard', 'panther', 'panthera pardus', 'leopards', 'tendua', 'black panther'],
      name: 'Indian Leopard (Panthera pardus fusca)',
      iucn: 'Vulnerable (Schedule I, WPA 1972)',
      threatLevel: 'HIGH',
      habitat: 'Extremely adaptable: dense rainforests, scrublands, tea estates, rocky hills, and urban edges.',
      diet: 'Opportunistic carnivore: Chital, langurs, rodents, wild pigs, stray dogs, young cattle.',
      speed: 'Up to 58 km/h; can leap 6m horizontally and 3m vertically.',
      weight: 'Males: 50–77 kg; Females: 29–45 kg.',
      facts: [
        'Master arboreal climber: capable of hoisting carcasses up to 3 times its own body weight into tree forks to keep away from hyenas and tigers.',
        'Rosettes on their coat lack central spots (unlike South American jaguars whose rosettes contain inner dots).',
        'Black panthers are not a separate species, but melanistic leopards with recessive gene alleles.',
        'Highly stealthy: often lives in agricultural sugar cane fields undetected by local villagers.'
      ],
      sop: [
        'Check tree branches and overhead canopy when patrolling leopard terrain.',
        'Never crouch or bend down — silhouettes resemble quadruped prey to big cats.',
        'Use high-intensity LED strobe torches at night to disorient sensitive feline eyes.',
        'Keep small children and pets within fenced perimeters during dusk and dawn.'
      ],
      chips: ['Leopard Safety SOP', 'Tree Ambush Defense', 'Recent Sightings', 'Sound Alarm']
    },
    {
      id: 'snow_leopard',
      aliases: ['snow leopard', 'panthera uncia', 'ghost of the mountains', 'him tendua'],
      name: 'Snow Leopard (Panthera uncia)',
      iucn: 'Vulnerable (Schedule I, WPA 1972)',
      threatLevel: 'HIGH',
      habitat: 'Alpine and subalpine rugged cliffs (3,000–5,500m) in Ladakh (Hemis NP), Spiti, Uttarakhand, Sikkim.',
      diet: 'Blue sheep (Bharal), Asiatic ibex, marmots, pikas, Tibetan hare.',
      speed: 'Can leap over 9–15 meters across mountain crevices.',
      weight: '30–55 kg with dense woolly fur and thick smoky-grey rosettes.',
      facts: [
        'Known as the "Ghost of the Mountains" because of its near-invisible camouflage against scree and boulders.',
        'Has an enormous thick tail (almost 1m long) used for balance and wrapped around the face for thermal insulation while sleeping.',
        'Cannot roar due to underdeveloped vocal cords; instead, it chuffs, hisses, growls, and mewls.',
        'Wide paws act as natural snowshoes, distributing weight evenly on deep winter snow.'
      ],
      sop: [
        'Snow leopards rarely attack humans; maintain safe distance and avoid cornering them on steep ridges.',
        'Ensure livestock corrals in high-altitude villages are predator-proofed with wire mesh roofs.'
      ],
      chips: ['Snow Leopard Intel', 'Mountain Habitats', 'Recent Sightings']
    },
    {
      id: 'lion',
      aliases: ['lion', 'asiatic lion', 'panthera leo', 'panthera leo persica', 'gir lion'],
      name: 'Asiatic Lion (Panthera leo persica)',
      iucn: 'Endangered (Schedule I, WPA 1972)',
      threatLevel: 'CRITICAL',
      habitat: 'Dry deciduous and teak scrub forests of Gir National Park and Greater Gir Landscape, Gujarat.',
      diet: 'Chital, Sambar, Nilgai, Wild Boar, domestic livestock.',
      speed: 'Up to 80 km/h in short charges.',
      weight: 'Males: 160–190 kg; Females: 110–120 kg.',
      facts: [
        'Smaller mane than African lions, leaving the ears always visible.',
        'Possesses a characteristic longitudinal fold of skin running along its belly (absent in African lions).',
        'Gir is the only wild habitat on Earth where Asiatic lions survive, rescued from near-extinction (around 20 in 1900 to over 670 today).',
        'Males live in bachelor coalitions; females form separate prides, uniting primarily for mating.'
      ],
      sop: [
        'Do not approach open grasslands on two-wheelers or on foot in the Gir scrub belt.',
        'If a lion approaches, stand together in a group, clap hands or bang metal sticks, and retreat slowly.'
      ],
      chips: ['Gir Lion Intel', 'Predator Status', 'Safety Protocol']
    },
    {
      id: 'elephant',
      aliases: ['elephant', 'asian elephant', 'elephas maximus', 'haathi', 'tusker', 'makna'],
      name: 'Asian Elephant (Elephas maximus)',
      iucn: 'Endangered (Schedule I, WPA 1972)',
      threatLevel: 'HIGH',
      habitat: 'Wet evergreen, moist deciduous, and dry scrub forests (Western Ghats, Northeast India, Nilgiris, Terai).',
      diet: 'Megaherbivore: grasses, bamboo, tree bark, wild fruits, roots, and sugarcane. Eats 150–200 kg daily.',
      speed: 'Can sprint up to 25–40 km/h; cannot jump because bones lack spring elasticity.',
      weight: '2,000–5,000 kg (up to 5 tonnes).',
      facts: [
        'Matriarchal society: herds are led by the oldest, wisest female elephant who remembers waterholes from decades past.',
        'Communicate using low-frequency infrasound (14–24 Hz) that travels through ground seismic waves for kilometers.',
        'A tusker is a male with prominent ivory tusks; a "Makna" is a tuskless male often possessing superior body bulk and aggression.',
        'Elephants drink 100–200 liters of water per day and need expansive seasonal migration corridors.'
      ],
      sop: [
        'Maintain at least 100 meters standoff distance; never position yourself between a mother and her calf.',
        'Watch for threat signals: ears spread wide and rigid, head held high, trunk curled tightly under chin, mock charges.',
        'Move uphill and upwind so the herd does not catch your scent.',
        'Use non-injurious acoustic deterrents (20–40 kHz ultrasonic alarms) or chilli-dung smoke barriers.'
      ],
      chips: ['Elephant Safety SOP', 'Elephant Corridors', 'Recent Sightings', 'Sound Alarm']
    },
    {
      id: 'rhino',
      aliases: ['rhino', 'rhinoceros', 'indian rhinoceros', 'greater one-horned rhino', 'rhinoceros unicornis', 'kaziranga rhino', 'gainda'],
      name: 'Greater One-Horned Rhinoceros (Rhinoceros unicornis)',
      iucn: 'Vulnerable (Schedule I, WPA 1972)',
      threatLevel: 'HIGH',
      habitat: 'Tall alluvial grasslands and riverine marshes of Kaziranga, Manas (Assam), and Jaldapara (West Bengal).',
      diet: 'Herbivore: elephant grass (Saccharum), reeds, aquatic plants, shrubs.',
      speed: 'Surprisingly agile: up to 55 km/h in straight-line charges.',
      weight: '1,800–2,800 kg.',
      facts: [
        'Skin has deep folds resembling rivets on medieval armour plates, but the skin itself is sensitive to insect bites.',
        'The horn is made of pure keratin (the same protein as human hair and nails), NOT bone.',
        'Have poor eyesight (around 30m) but acute hearing and exceptional sense of smell.',
        'Over 70% of the world\'s wild population lives in Assam\'s Kaziranga National Park.'
      ],
      sop: [
        'Never walk through tall elephant grass (tall grass obstructs sightlines for both human and rhino).',
        'If a rhino charges, climb a sturdy tree or run in a zigzag pattern around obstacles (rhinos struggle with tight turning radiuses).'
      ],
      chips: ['Rhino Intel', 'Kaziranga Grasslands', 'Recent Sightings']
    },
    {
      id: 'gaur',
      aliases: ['gaur', 'indian bison', 'bos gaurus', 'mithun', 'bison'],
      name: 'Indian Gaur (Bos gaurus)',
      iucn: 'Vulnerable (Schedule I, WPA 1972)',
      threatLevel: 'MEDIUM',
      habitat: 'Evergreen, moist deciduous forests and bamboo groves of Western Ghats (Bandipur, Mudumalai, Periyar, Nagarhole).',
      diet: 'Herbivore: coarse grasses, bamboo shoots, leaves, bark.',
      speed: 'Can gallop up to 45–50 km/h.',
      weight: 'Males: 800–1,500 kg (largest extant wild bovine on Earth, taller than American bison).',
      facts: [
        'Characterized by a high muscular dorsal ridge and pale, stocking-like white legs.',
        'A single blow from an adult gaur horn can grievously wound or kill a tiger.',
        'Gaur herds emit an extraordinary high-pitched musical whistle/fife call as an alarm signal.',
        'Tigers prey primarily on gaur calves or sick adults; healthy bulls are rarely challenged.'
      ],
      sop: [
        'Keep safe distance from lone solitary bulls (they are more temperamental than herd females).',
        'Do not block forest fire lines or water holes where herds congregate.'
      ],
      chips: ['Gaur Intel', 'Western Ghats Fauna', 'Recent Sightings']
    },
    {
      id: 'sloth_bear',
      aliases: ['bear', 'sloth bear', 'melursus ursinus', 'bhalu', 'bears'],
      name: 'Sloth Bear (Melursus ursinus)',
      iucn: 'Vulnerable (Schedule I, WPA 1972)',
      threatLevel: 'HIGH',
      habitat: 'Dry and moist deciduous forests, scrublands, boulder-strewn hills across Central India, Karnataka, and MP.',
      diet: 'Myrmecophage (insectivorous): termites, ants, honeycombs, wild mahua flowers, berries.',
      speed: 'Up to 35–40 km/h.',
      weight: '80–140 kg with shaggy black coat and whitish Y- or V-shaped chest mark.',
      facts: [
        'Specially adapted for termite feeding: lacks upper incisors, allowing it to suck termites through a vacuum gap with sounds audible 100m away.',
        'Equipped with 3-inch curved non-retractile white claws used for digging into concrete-hard termite mounds.',
        'Mother sloth bears carry their cubs on their backs while walking or running — unique among bear species.',
        'Poor eyesight and hearing: often get startled when humans accidentally stumble upon them in dense scrub.'
      ],
      sop: [
        'Make vocal sounds, snap twigs, or talk while walking in scrub forests to prevent startling a bear.',
        'Never run if you encounter a sloth bear at close quarters; stand ground, raise arms, speak firmly.',
        'If attacked, drop into a fetal ball protecting neck, face, and abdomen.'
      ],
      chips: ['Sloth Bear SOP', 'Scrub Forest Hazards', 'Recent Sightings', 'Sound Alarm']
    },
    {
      id: 'dhole',
      aliases: ['dhole', 'wild dog', 'asiatic wild dog', 'cuon alpinus', 'red dog'],
      name: 'Dhole / Asiatic Wild Dog (Cuon alpinus)',
      iucn: 'Endangered (Schedule I, WPA 1972)',
      threatLevel: 'MEDIUM',
      habitat: 'Dense forests, deciduous jungles, and alpine regions of Central India, Western Ghats, and Northeast.',
      diet: 'Carnivore pack hunters: Chital, Sambar, wild boar, mouse deer, hares.',
      speed: 'Exceptional stamina: can run prey down at 45 km/h over long distances.',
      weight: '12–18 kg; reddish-brown coat with black bushy tail.',
      facts: [
        'Communicate using eerie bird-like whistles, clucks, and chitters instead of barking.',
        'Hunt in coordinated cooperative clans of 5 to 25 dogs with nearly 70% kill success rates.',
        'Extremely territorial: packs have been recorded defending their territory and driving leopards and tigers up trees.',
        'Dholes are not dangerous to humans in the wild and typically retreat upon human approach.'
      ],
      chips: ['Dhole Intel', 'Pack Dynamics', 'Recent Sightings']
    },
    {
      id: 'king_cobra',
      aliases: ['king cobra', 'ophiophagus hannah', 'rajnag', 'hamadryad'],
      name: 'King Cobra (Ophiophagus hannah)',
      iucn: 'Vulnerable (Schedule I, WPA 1972)',
      threatLevel: 'CRITICAL',
      habitat: 'Dense rainforests, bamboo thickets, mangrove swamps (Western Ghats, Agumbe, Sundarbans, Northeast).',
      diet: 'Strictly ophiophagous (eats other snakes: rat snakes, pit vipers, cobras, small pythons).',
      length: 'World\'s longest venomous snake: can reach 3.6 to 5.5 meters (12–18 feet).',
      facts: [
        'Only snake in the world that builds an above-ground nest of dead leaves for her eggs and guards them fiercely.',
        'Can lift a third of its body straight off the ground (up to eye-level with an adult human) while hooded.',
        'Produces a low-frequency growling hiss (resembling a growling dog) rather than a high-pitched hiss.',
        'A single bite can deliver up to 7ml (500mg) of venom — enough neurotoxin to kill an adult Asian elephant in 3 hours.'
      ],
      sop: [
        'Freeze immediately if you see a King Cobra in threat posture with hood expanded.',
        'Do not make sudden jerky movements; slowly and smoothly step backward.',
        'King Cobras are generally shy and prefer to escape into undergrowth if not cornered or defending a nest.'
      ],
      chips: ['King Cobra SOP', 'Big Four Venomous Snakes', 'Snakebite Protocol']
    },
    {
      id: 'big_four_snakes',
      aliases: ['big four', 'venomous snakes', 'snake', 'snakes', 'cobra', 'krait', 'viper', 'russell viper', 'saw scaled viper'],
      name: 'The Big Four Venomous Snakes of India',
      threatLevel: 'CRITICAL',
      facts: [
        '1. **Spectacled Cobra (Naja naja):** Post-synaptic neurotoxic venom. Recognizable by "spectacle" mark on hood. Causes respiratory paralysis.',
        '2. **Common Krait (Bungarus caeruleus):** Pre-synaptic neurotoxic venom (15x deadlier than cobra). Bites often happen indoors at night and can be completely painless with minimal swelling.',
        '3. **Russell\'s Viper (Daboia russelii):** Powerful hemotoxic and cytotoxic venom. Thick triangular head, loud warning hiss like a pressure cooker, geometric chain pattern.',
        '4. **Saw-scaled Viper (Echis carinatus):** Hemotoxic venom. Rubs its serrated keeled scales together in an "S" shape producing a rasping sizzle sound before striking lightning-fast.'
      ],
      sop: [
        '**DO NOT USE A TOURNIQUET** — tourniquets cause severe local tissue necrosis and limb amputation.',
        '**DO NOT CUT, BURN, OR SUCK** the wound (cinema myths that worsen poisoning and introduce infection).',
        'Immobilize the bitten limb immediately with a splint or firm pressure-immobilization bandage.',
        'Keep the victim completely motionless and calm to slow lymphatic venom spread.',
        'Transport immediately to the nearest hospital for Polyvalent Anti-Snake Venom (ASV).'
      ],
      chips: ['Snakebite Protocol', 'Anti-Venom Info', 'Forest First Aid']
    },
    {
      id: 'crocodile',
      aliases: ['crocodile', 'mugger', 'gharial', 'saltwater crocodile', 'croc'],
      name: 'Indian Crocodilians (Mugger, Gharial, Saltwater)',
      threatLevel: 'CRITICAL',
      facts: [
        '1. **Mugger / Marsh Crocodile (Crocodylus palustris):** Broad snout, freshwater rivers and lakes, ambush predator up to 4.5m.',
        '2. **Gharial (Gavialis gangeticus):** Critically endangered. Extremely narrow snout adapted exclusively for fish; adult males develop a bulbous nasal pot called a "Ghara".',
        '3. **Saltwater Crocodile (Crocodylus porosus):** Largest living reptile on Earth (up to 6–7 meters, 1,000+ kg). Lives in mangrove estuaries (Sundarbans, Bhitarkanika) and can tackle adult tigers.'
      ],
      sop: [
        'Never wash hands, collect water, or stand within 3 meters of turbid riverbanks in mangrove estuaries.',
        'Cross rivers only at designated bridges or high-clearance motorized patrol vessels.'
      ],
      chips: ['Crocodile Safety', 'Sundarbans Biome', 'River Crossing SOP']
    },
    {
      id: 'cheetah',
      aliases: ['cheetah', 'acinonyx jubatus', 'cheetahs', 'kuno cheetah', 'project cheetah'],
      name: 'Cheetah (Acinonyx jubatus)',
      iucn: 'Vulnerable (Extirpated in India 1952, Reintroduced 2022)',
      threatLevel: 'MEDIUM',
      habitat: 'Open savanna grasslands, dry acacia scrublands (Kuno National Park, Gandhi Sagar Wildlife Sanctuary, MP).',
      diet: 'Carnivore diurnal stalker: Chital (spotted deer), blackbucks, chinkara (Indian gazelle), hares.',
      speed: 'World\'s fastest land animal: 110–120 km/h (0 to 100 km/h in 3 seconds).',
      weight: '34–64 kg with slender aerodynamic frame and semi-retractile traction claws.',
      facts: [
        'Declared officially extinct in India in 1952; reintroduced in 2022 under Project Cheetah from Namibia and South Africa to Kuno NP.',
        'Distinctive black "tear streaks" running from the inner corners of their eyes to their mouth deflect sun glare during daytime hunts.',
        'Cheetahs cannot roar like lions and tigers; they communicate via high-pitched chirps, purrs, and chuffs.',
        'Non-aggressive toward humans in the wild and possess lightweight skulls with smaller canines to maximize nasal cavity size for oxygen intake.'
      ],
      sop: [
        'Do not approach cheetah reintroduction enclosure fences in Kuno.',
        'If encountered in open scrub, stand tall and do not run — cheetahs possess a chase reflex against fleeing targets.'
      ],
      chips: ['Project Cheetah (Kuno)', 'Cheetah vs Leopard', 'Fastest Animals']
    },
    {
      id: 'wolf_jackal',
      aliases: ['wolf', 'indian wolf', 'wolves', 'canis lupus pallipes', 'jackal', 'golden jackal', 'canis aureus'],
      name: 'Indian Wolf & Golden Jackal (Canidae)',
      iucn: 'Wolf: Endangered (Schedule I); Jackal: Least Concern (Schedule II)',
      threatLevel: 'MEDIUM',
      habitat: 'Arid grasslands, open scrub, agro-pastoral scrub belts (Deccan plateau, Rajasthan, Gujarat).',
      diet: 'Carnivores / Opportunistic omnivores: Blackbuck, chinkara, hares, rodents, fallen fruit, carrion.',
      speed: 'Can sustain steady pursuit at 50–60 km/h over kilometers.',
      weight: 'Indian Wolf: 18–25 kg; Golden Jackal: 8–11 kg.',
      facts: [
        'The Indian Wolf is an ancient, genetically distinct wolf lineage adapted to hot, arid scrub terrains with shorter, thinner coats.',
        'Golden Jackals often follow tigers and leopards at a distance to scavenge on leftover carcasses and sound alarm cries ("pheal") when big cats move.',
        'Wolves form tight nuclear family packs with devoted parental care and territorial howling calls.'
      ],
      sop: [
        'Safeguard village goat and sheep pens with secure stone walls or solar mesh in open scrub corridors.'
      ],
      chips: ['Indian Wolf Intel', 'Scrub Forest Hazards', 'Recent Sightings']
    },
    {
      id: 'hyena',
      aliases: ['hyena', 'striped hyena', 'hyaena hyaena', 'hyenas', 'lakadbaggha'],
      name: 'Striped Hyena (Hyaena hyaena)',
      iucn: 'Near Threatened (Schedule III, WPA 1972)',
      threatLevel: 'LOW',
      habitat: 'Dry deciduous scrub, ravines, rocky hills, semi-desert scrublands across Central India, Rajasthan, and Gujarat.',
      diet: 'Scavenger & carnivore: Animal carcasses, bones, small mammals, wild fruits, melons.',
      speed: 'Can lope up to 50 km/h.',
      weight: '25–45 kg; sloping back with longer front legs and erectile dorsal mane.',
      facts: [
        'Possesses immense crushing jaw power (over 800 PSI) capable of pulverizing and digesting the thickest mammalian leg bones.',
        'Extremely nocturnal and shy; rarely encountered by day and retreats rapidly upon seeing humans.',
        'Unlike the spotted hyena of Africa, the Indian striped hyena is largely solitary or lives in pairs, not in massive predatory clans.'
      ],
      sop: [
        'Hyenas rarely challenge adult humans; maintain campfire perimeter in wilderness camps.'
      ],
      chips: ['Hyena Intel', 'Scrub Biome', 'Night Patrol Protocols']
    },
    {
      id: 'deer',
      aliases: ['deer', 'chital', 'spotted deer', 'sambar', 'barasingha', 'swamp deer', 'barking deer', 'muntjac', 'blackbuck', 'nilgai'],
      name: 'Indian Ungulates (Sambar, Chital, Barasingha, Blackbuck)',
      threatLevel: 'LOW',
      habitat: 'Forests, river grasslands, scrublands, and open plains across all Indian tiger landscapes.',
      diet: 'Herbivores: Grasses, leaves, fallen fruits, aquatic plants, tree bark.',
      speed: 'Chital & Blackbuck sprint at 80–90 km/h; phenomenal leaping ability.',
      weight: 'Sambar: 200–320 kg; Chital: 45–85 kg; Barasingha: 160–280 kg; Nilgai: 120–240 kg.',
      facts: [
        '**Sambar:** The largest deer in Asia; primary prey of Bengal tigers. Emits a sharp, bell-like alarm honk when it detects a predator.',
        '**Chital (Spotted Deer):** Maintain permanent white spots throughout their life; live in mutualistic feeding associations with Langur monkeys.',
        '**Barasingha (Swamp Deer):** Famous for having up to 12 tines on their antlers; Kanha National Park\'s official mascot is "Bhoorsingh the Barasingha".',
        '**Blackbuck:** Indian antelope famous for spiral corkscrew horns and explosive 80 km/h sprints.'
      ],
      chips: ['Horns vs Antlers', 'Tiger Prey Dynamics', 'Herbivore Ecology']
    },
    {
      id: 'peafowl',
      aliases: ['peafowl', 'peacock', 'indian peafowl', 'pavo cristatus', 'morn', 'national bird'],
      name: 'Indian Peafowl / Peacock (Pavo cristatus)',
      iucn: 'Least Concern (Schedule I, National Bird of India)',
      threatLevel: 'LOW',
      habitat: 'Moist and dry deciduous forests, scrublands, village borders, and agricultural margins nationwide.',
      diet: 'Omnivore: Seeds, tender shoots, berries, insects, scorpions, and small venomous snakes.',
      speed: 'Can fly into forest tree canopies to roost at night; runs fast on ground.',
      facts: [
        'Declared the **National Bird of India** in 1963 for its beauty, mythology, and pan-Indian presence.',
        'The male\'s famous train consists of upper tail covert feathers (up to 200 feathers with iridescent "eyes" or ocelli), NOT tail feathers.',
        'Peafowl act as the prime **auditory alarm system of the jungle**: their harsh, trumpet-like "may-awe" cries alert all herbivores when a tiger or leopard begins to move.',
        'Known to attack and consume small poisonous snakes, including young cobras.'
      ],
      chips: ['National Bird of India', 'Jungle Alarm Calls', 'Tiger Stalking Behavior']
    },
    {
      id: 'dolphin',
      aliases: ['dolphin', 'gangetic dolphin', 'river dolphin', 'platanista gangetica', 'susu', 'national aquatic animal'],
      name: 'South Asian River Dolphin / Gangetic Dolphin (Platanista gangetica)',
      iucn: 'Endangered (Schedule I, National Aquatic Animal of India)',
      threatLevel: 'LOW',
      habitat: 'Deep freshwater pools and river bends of Ganga, Brahmaputra, and their tributaries.',
      diet: 'Piscivore: Freshwater fish, shrimp, bottom-dwelling crustaceans.',
      facts: [
        'Declared the **National Aquatic Animal of India** in 2009.',
        'Functionally **blind**: its eyes lack crystalline lenses. Navigates and hunts in muddy riverbeds using sophisticated ultrasonic echolocation (sonar clicks).',
        'Nicknamed "Susu" because of the distinct breathing sound it makes when surfacing for air every 30–120 seconds.',
        'Acts as a vital indicator species for the ecological health of the entire Ganga and Brahmaputra river ecosystems.'
      ],
      chips: ['National Aquatic Animal', 'River Ecology', 'Sundarbans Biome']
    },
    {
      id: 'pangolin',
      aliases: ['pangolin', 'indian pangolin', 'manis crassicaudata', 'scaly anteater'],
      name: 'Indian Pangolin (Manis crassicaudata)',
      iucn: 'Endangered (Schedule I, WPA 1972)',
      threatLevel: 'LOW',
      habitat: 'Tropical forests, scrublands, and rocky hills across Central, Eastern, and Southern India.',
      diet: 'Myrmecophage: Termites, ants, and their pupae (eats up to 70 million insects annually).',
      weight: '8–16 kg covered in armor of overlapping keratin scales.',
      facts: [
        'World\'s most heavily trafficked wild mammal due to illicit demand for its keratin scales in traditional remedies.',
        'When threatened, it rolls into an impenetrable spherical ball, tucked with a muscular tail that predators cannot pry open.',
        'Possesses no teeth; uses a long, sticky tongue (longer than its entire body) anchored to its pelvis to lap up insects.'
      ],
      chips: ['Pangolin Intel', 'Anti-Poaching Tech', 'Wildlife Protection Act']
    },
    {
      id: 'monkey',
      aliases: ['monkey', 'langur', 'hanuman langur', 'semnopithecus', 'rhesus macaque', 'macaque', 'bandar'],
      name: 'Hanuman Langur & Rhesus Macaque (Primates)',
      threatLevel: 'LOW',
      habitat: 'Canopies of rainforests, deciduous jungles, temples, and village fringes across India.',
      diet: 'Folivore / Omnivore: Leaves, fruits, flowers, seeds, insects.',
      facts: [
        '**The Jungle\'s Top Lookout:** Hanuman Langurs sit in the tallest canopy branches and drop high-pitched barking alarm calls ("cough-calls") the instant they spot a tiger or leopard, alerting the entire forest floor.',
        'Langurs have multi-chambered stomachs with specialized bacteria that ferment tough cellulose in toxic forest leaves.',
        'Form strong symbiotic partnerships with Chital deer: langurs drop nutritious leaves and fruits from the canopy, while deer keep ground watch for predators.'
      ],
      chips: ['Jungle Alarm Calls', 'Langur & Deer Symbiosis', 'Canopy Ecology']
    }
  ];

  // ==========================================================================
  // JUNGLE SURVIVAL, BUSHCRAFT & FIRST AID DATABASE
  // ==========================================================================
  const JUNGLE_SURVIVAL = {
    water: {
      title: '💧 Finding & Purifying Water in the Jungle',
      content: [
        '**Safe Water Vines:** Thick, woody vines (like water lianas) can yield fresh water. Cut high first, then cut near the ground to break vacuum. Ensure the sap is crystal clear and watery — never drink cloudy, milky, or bitter sap.',
        '**Green Bamboo Culms:** Bend green bamboo culms downward or tap internodes near the base for clean trapped rainwater.',
        '**Transpiration Bag:** Tie a clear plastic bag over leafy green tree branches exposed to sunlight. Evaporation from leaves condenses into clean drinkable water.',
        '**Three-Layer Survival Filter:** In a cut bottle or bamboo tube: top layer fine sand, middle layer crushed charcoal from campfire, bottom layer coarse gravel/grass. Always boil filtered water for at least 3–5 minutes before drinking.'
      ],
      chips: ['Jungle Navigation', 'Emergency Shelter', 'Fire Making']
    },
    navigation: {
      title: '🧭 Jungle Navigation Without a Compass',
      content: [
        '**Shadow-Stick Method:** Place a 1-meter stick vertically in the ground. Mark the shadow tip with a stone. Wait 20 minutes, mark the second shadow tip. A line from mark 1 to mark 2 runs West to East.',
        '**Waterflow Orientation:** In hilly jungles, small rivulets join streams, which join larger rivers. Rivers almost always lead down to civilization, ranger stations, or coastlines.',
        '**Vegetation & Sun:** The side of trees facing the midday sun (south in northern hemisphere) generally has denser foliage and drier bark; the damp shaded northern side often hosts heavier moss growth.'
      ],
      chips: ['Water Finding', 'Shelter Craft', 'Leech Protection']
    },
    shelter: {
      title: '⛺ Jungle Emergency Shelter Craft',
      content: [
        '**The Raised Platform:** In tropical jungles, NEVER sleep directly on the bare ground. Ground humidity, venomous centipedes, scorpions, and vipers make direct sleeping perilous. Build a raised platform 60 cm off the ground using lashed bamboo.',
        '**A-Frame Lean-To:** Pitch a sturdy ridgepole between two trees at a 45-degree angle. Layer palm fronds or broad banana leaves shingle-style from bottom to top so rain runs off without penetrating.',
        '**Site Selection:** Avoid dry riverbeds (flash floods occur miles away without rain overhead) and avoid standing dead trees ("widowmakers" that fall in wind).'
      ],
      chips: ['Water Finding', 'Leech Protection', 'Jungle Navigation']
    },
    leeches: {
      title: '🩸 Leeches & Insect Protection in Tropical Rainforests',
      content: [
        '**Leech Socks:** Wear densely woven cotton leech socks over trousers, tucked into boots. Soak the outside in tobacco-infused brine or eucalyptus/neem oil.',
        '**Safe Leech Removal:** Never pull or burn an attached leech; burning causes the leech to vomit gut bacteria (Aeromonas) into the bloodstream causing severe infection. Slide a fingernail or knife edge under the oral sucker to break the suction seal.',
        '**Tick Removal:** Use fine-tipped tweezers to grasp the tick as close to the skin as possible. Pull upward with steady, even pressure. Do not twist.'
      ],
      chips: ['Snakebite Protocol', 'Forest First Aid', 'Shelter Craft']
    },
    snakebite: {
      title: '⚕️ Emergency Venomous Snakebite First Aid Protocol',
      content: [
        '**Golden Rule (Do No Harm):** Do NOT cut the fang punctures. Do NOT use suction devices. Do NOT apply a tourniquet. Do NOT apply ice, potassium permanganate, or herbal pastes.',
        '**Pressure Immobilization:** Splint the bitten limb to prevent joint movement (muscular movement pumps venom through lymph vessels into systemic circulation).',
        '**Remove Constrictive Items:** Immediately remove rings, bangles, watches, and tight boots before swelling sets in.',
        '**Immediate Transport:** Rush to a hospital equipped with Polyvalent Anti-Snake Venom (ASV). India\'s polyvalent ASV neutralizes all of The Big Four venomous species.'
      ],
      chips: ['Big Four Snakes', 'King Cobra SOP', 'Forest First Aid']
    }
  };

  // ==========================================================================
  // FOREST ECOLOGY, NATIONAL PARKS & CONSERVATION DATABASE
  // ==========================================================================
  const FOREST_ECOLOGY = {
    sundarbans: {
      title: '🌊 The Sundarbans Mangrove Delta',
      content: [
        '**World\'s Largest Mangrove Ecosystem:** Spanning 10,000 sq km across India (West Bengal) and Bangladesh in the delta of the Ganga, Brahmaputra, and Meghna rivers.',
        '**Tidal Adaptations:** Sundari trees (Heritiera fomes) and mangrove roots feature specialized breathing roots called *pneumatophores* that protrude vertically above salt mud to breathe oxygen at low tide.',
        '**Swimming Tigers:** The only mangrove forest inhabited by Bengal tigers. These tigers are renowned for swimming across 4-km-wide tidal estuaries and hunting spotted deer and wild boars in saline mud.'
      ],
      chips: ['Kaziranga Grasslands', 'Corbett Tiger Reserve', 'Western Ghats']
    },
    kaziranga: {
      title: '🦏 Kaziranga National Park (Assam)',
      content: [
        '**Grassland Super-Habitat:** Situated on the fertile floodplains of the Brahmaputra River. Composed of elephant grass, marshland, and dense tropical moist broadleaf forest.',
        '**Global Rhino Stronghold:** Hosts over 2,600 Greater One-Horned Rhinos (over two-thirds of the world population), alongside the highest density of wild tigers in protected areas, wild water buffaloes, and eastern swamp deer.'
      ],
      chips: ['Sundarbans Delta', 'Western Ghats', 'Rhino Intel']
    },
    corbett: {
      title: '🌲 Jim Corbett National Park (Uttarakhand)',
      content: [
        '**India\'s Oldest National Park:** Established in 1936 as Hailey National Park; renamed in honor of naturalist and conservationist Jim Corbett.',
        '**Birthplace of Project Tiger:** In April 1973, Project Tiger was officially launched from Corbett to rescue the species from extinction.',
        '**Geography:** Encompasses the Ramganga river valley, Shivalik foothills, dense Sal (Shorea robusta) forests, and elephant corridors.'
      ],
      chips: ['Ranthambore Reserve', 'Project Tiger Info', 'Pugmark Identification']
    },
    ranthambore: {
      title: '🏰 Ranthambore Tiger Reserve (Rajasthan)',
      content: [
        '**Jungle Meets History:** Located at the junction of the Aravalli and Vindhya hill ranges, centered around the 10th-century Ranthambore Fort.',
        '**Dry Deciduous Biome:** Dominated by Dhok trees (Anogeissus pendula). Famous for diurnal tigers hunting around the lotus-covered Padam Talao lake.'
      ],
      chips: ['Corbett Reserve', 'Tiger Safety SOP', 'Pugmark Identification']
    },
    western_ghats: {
      title: '🌿 The Western Ghats (Sahyadri Hotspot)',
      content: [
        '**Global Biodiversity Hotspot:** Older than the Himalayas, stretching 1,600 km along India\'s western coast.',
        '**Shola-Grassland Mosaic:** High-altitude undulating grasslands interspersed with stunted evergreen rainforest patches known as *Sholas*.',
        '**Endemic Treasures:** Home to the Lion-tailed Macaque, Nilgiri Tahr, Nilgiri Langur, Malabar Gliding Frog, and over 39 UNESCO World Heritage protected sectors.'
      ],
      chips: ['Sundarbans Delta', 'Gaur Intel', 'Elephant Corridors']
    },
    pugmark: {
      title: '🐾 Reading Animal Tracks: Pugmark Identification',
      content: [
        '**Tiger vs Leopard:** Tiger pugmarks measure 10–16 cm across, while leopards measure 7–9 cm. Big cats have 4 toes and a 3-lobed heel pad with NO claw marks (their claws retract while walking).',
        '**Canids (Wild Dogs / Jackals):** Show clear, non-retractile claw impressions in front of the toe pads.',
        '**Male vs Female Tiger:** A male tiger\'s pugmark fits neatly into a square bounding frame; a female tiger\'s pugmark is narrower and fits into a rectangular frame.',
        '**Plaster Casts (Pug Impression Pads - PIP):** Fine dust pads laid along forest trails to record animal presence without electronic hardware.'
      ],
      chips: ['Tiger Intel', 'Leopard Intel', 'Camera Trapping']
    },
    corridors: {
      title: '🐘 Wildlife Corridors & Human-Wildlife Conflict Mitigation',
      content: [
        '**Habitat Corridors:** Narrow ecological pathways that connect fragmented forest patches, allowing animals to migrate for food, water, and genetic diversity without encountering settlements.',
        '**Mitigation Techniques:**',
        '• **Bio-Fencing:** Planting thorny agave, cactus, or lemon-grass rows.',
        '• **Beehive Fencing:** Elephants have thin skin around eyes and trunk and avoid honeybee swarms.',
        '• **Solar Perimeter Fencing:** High-voltage, low-amperage pulsing electric fence (gives non-lethal shock).',
        '• **Acoustic & Radio Early Warning:** FieldWatch ultrasonic radar + YOLO camera nodes warn village monitors before animals exit the forest buffer zone.'
      ],
      chips: ['Elephant Intel', 'FieldWatch Hardware', 'Safety Protocol']
    }
  };

  // ==========================================================================
  // GENERAL KNOWLEDGE & BIOLOGY FAQS
  // ==========================================================================
  const WILDLIFE_FAQS = [
    {
      id: 'king_of_jungle',
      keywords: [
        'king of jungle', 'king of the jungle', 'king of forest', 'king of the forest', 
        'king of beasts', 'king of the beasts', 'king of wild', 'king of the wild',
        'king of animal', 'king of animals', 'king of the animals', 'who is the king of jungle',
        'who is king of jungle', 'who is king of the jungle', 'who is the king of the jungle',
        'who is the king of the forest', 'who is king of forest', 'ruler of the jungle',
        'ruler of jungle', 'jungle king', 'forest king'
      ],
      title: 'Who is the King of the Jungle? (Lion vs Tiger)',
      text: `👑 **WHO IS THE TRUE KING OF THE JUNGLE?**\n\n` +
        `Historically and culturally, the **Lion** has been crowned the *"King of Beasts"* and *"King of the Jungle"*, but from a zoological perspective, the answer is fascinating:\n\n` +
        `🦁 **The Myth: Why the Lion Holds the Title:**\n` +
        `• **Regal Appearance:** The male lion's majestic dark mane, commanding upright posture, and thunderous roar (audible up to 8 km / 5 miles) symbolize royalty across heraldry, folklore, and literature.\n` +
        `• **Social Pride Hierarchy:** Lions rule over social prides, patrolling and defending their territory together like a royal monarchy.\n\n` +
        `🐅 **The Biological Reality: The Bengal Tiger Rules the Jungle:**\n` +
        `• **Lions Don't Live in Jungles:** Lions naturally inhabit open African savannas, grasslands, and dry scrub forests (such as Gir in Gujarat). They do NOT live in dense tropical rainforests.\n` +
        `• **The True Monarch of the Dense Forest:** In actual tropical jungles, rainforests, and mangrove swamps across Asia, the **Bengal Tiger (Panthera tigris)** is the undisputed apex predator!\n` +
        `• **Size & Physical Superiority:** Bengal tigers are heavier (up to 260+ kg vs a male lion's 190 kg), possess denser muscle mass, longer canines, and a higher bite force (1,050 PSI vs 650 PSI).\n` +
        `• **Solitary Mastery:** Tigers dominate dense canopies and swim across turbulent rivers independently, reigning as solitary kings over their territory.\n\n` +
        `**Verdict:** In popular folklore, the **Lion** holds the crown; but ecologically in real dense jungles, the **Tiger** is the true sovereign ruler!`,
      chips: ['Tiger vs Lion', 'Bengal Tiger Profile', 'Asiatic Lion (Gir)', 'Deadliest Animals']
    },
    {
      id: 'tiger_vs_lion',
      keywords: [
        'tiger vs lion', 'lion vs tiger', 'tiger or lion', 'lion or tiger',
        'who would win tiger or lion', 'who is stronger tiger or lion',
        'tiger fight lion', 'can a tiger defeat a lion', 'can a lion beat a tiger',
        'who wins tiger or lion'
      ],
      title: 'Tiger vs Lion: Who Would Win in a Fight?',
      text: `🥊 **TIGER vs. LION: ZOOLOGICAL COMPARISON**\n\n` +
        `• **Weight & Muscle:** Male Bengal tigers average **180–260 kg**, while Asiatic/African male lions average **160–190 kg**. Tigers possess a higher muscle-to-fat ratio and lower center of gravity.\n` +
        `• **Bite Force:** A Bengal tiger generates **~1,050 PSI** of jaw crushing force, compared to a lion's **~650 PSI**.\n` +
        `• **Paw Strike & Combat Style:**\n` +
        `  - **Tiger:** Solitary hunter with phenomenal balance. Can rear up on its hind legs and swipe with **both front paws simultaneously** with lightning speed.\n` +
        `  - **Lion:** Pride wrestler adapted for head-to-head brawling. Its thick mane protects its neck from fatal bites, but it typically swiping with one paw at a time.\n` +
        `• **Historical Arena Records:** In ancient Roman colosseums and historical menageries (e.g. 19th-century royal animal fights), tigers won the vast majority of direct single combat confrontations.\n\n` +
        `**Scientific Consensus:** In a one-on-one duel, an adult male Bengal Tiger has a distinct physiological advantage in weight, striking speed, and canine depth over a lion.`,
      chips: ['King of the Jungle', 'Bengal Tiger Profile', 'Asiatic Lion (Gir)', 'Fastest Animals']
    },
    {
      id: 'fastest_animals',
      keywords: [
        'fastest animal', 'fastest land animal', 'speed of fastest animal',
        'fastest bird', 'fastest mammal', 'fastest creature', 'fastest in the world',
        'cheetah speed', 'what is the fastest', 'who is the fastest animal', 'fastest animal in jungle'
      ],
      title: 'What is the fastest animal on Earth?',
      text: `⚡ **THE SPEED KINGS OF THE ANIMAL KINGDOM**\n\n` +
        `• **Fastest Overall (Air):** The **Peregrine Falcon** (*Falco peregrinus*) reaches over **389 km/h (242 mph)** during its high-velocity hunting stoop dive.\n` +
        `• **Fastest Land Mammal:** The **Cheetah** (*Acinonyx jubatus*) sprints up to **110–120 km/h (70–75 mph)** in bursts of 400–500 meters, accelerating 0 to 100 km/h in just 3 seconds!\n` +
        `  *(Note: In India, Asiatic cheetahs went extinct in 1952, but Project Cheetah is reintroducing them in Kuno National Park, MP).*\n` +
        `• **Fastest in the Ocean:** The **Black Marlin / Sailfish** clocks swimming speeds of up to **110–129 km/h (68–80 mph)**.\n` +
        `• **Fastest Jungle Stalker:** The **Bengal Tiger** can accelerate to **65 km/h** in short predatory lunges through dense grass.`,
      chips: ['Project Cheetah (Kuno)', 'Tiger Speed', 'Elephant Speed', 'King of the Jungle']
    },
    {
      id: 'largest_animals',
      keywords: [
        'biggest animal', 'largest animal', 'heaviest animal', 'largest land animal',
        'biggest mammal', 'largest mammal', 'largest predator', 'biggest creature',
        'largest living animal', 'what is the biggest animal'
      ],
      title: 'What is the largest animal on Earth and on land?',
      text: `🐋 **THE GIANTS OF THE PLANET**\n\n` +
        `• **Largest Animal Ever to Exist:** The **Blue Whale** (*Balaenoptera musculus*) reaches up to **30 meters (98 ft)** in length and weighs up to **190–200 metric tonnes** (its tongue alone weighs as much as an elephant!).\n` +
        `• **Largest Land Mammal:** The **African Bush Elephant** (*Loxodonta africana*) reaches up to **6,000 kg (6 tonnes)** and 3.3 meters in shoulder height.\n` +
        `• **Largest Land Mammal in India/Asia:** The **Asian Elephant** (*Elephas maximus*), weighing up to **5,000 kg (5 tonnes)**.\n` +
        `• **Largest Wild Bovine:** The **Indian Gaur** (*Bos gaurus*), bulls reaching up to **1,500 kg**.\n` +
        `• **Largest Living Reptile:** The **Saltwater Crocodile** (*Crocodylus porosus*), reaching up to **6–7 meters (20–23 ft)** and **1,000+ kg** in the Sundarbans and Bhitarkanika.`,
      chips: ['Asian Elephant', 'Indian Gaur', 'Saltwater Crocodile', 'Deadliest Animals']
    },
    {
      id: 'deadliest_animals',
      keywords: [
        'deadliest animal', 'most dangerous animal', 'most deadly animal',
        'what animal kills the most humans', 'deadliest creature', 'most lethal animal',
        'most dangerous animal in india', 'most dangerous animal in jungle'
      ],
      title: 'What is the deadliest animal in the world and in the jungle?',
      text: `⚠️ **THE DEADLIEST ANIMALS TO HUMANS**\n\n` +
        `• **#1 Worldwide:** The **Mosquito** is responsible for **700,000+ human deaths every year** through vector-borne diseases like malaria, dengue, and yellow fever.\n` +
        `• **#1 Wild Animal in India:** **Venomous Snakes** (The Big Four: Russell's Viper, Saw-scaled Viper, Spectacled Cobra, Common Krait) cause approximately **58,000 fatalities annually** across rural India.\n` +
        `• **Deadliest Big Mammal in India:** **Asian Elephants** (responsible for ~500 human deaths per year due to human-wildlife conflict and crop-raiding) and **Sloth Bears** (notorious for ferocious defensive attacks when startled in scrub).\n` +
        `• **Apex Predators:** While Bengal Tigers and Leopards receive intense media attention, actual human encounters are rare and usually occur when sick or injured cats are displaced into human agricultural buffers.`,
      chips: ['Big Four Snakes', 'Snakebite Protocol', 'Sloth Bear SOP', 'Elephant Conflict']
    },
    {
      id: 'national_symbols',
      keywords: [
        'national animal', 'national bird', 'national animal of india',
        'national heritage animal', 'national aquatic animal', 'national reptile',
        'national animals of india', 'india national animal', 'what is the national animal of india',
        'national symbols of india'
      ],
      title: 'National Animals & Wildlife Symbols of India',
      text: `🇮🇳 **OFFICIAL NATIONAL WILDLIFE SYMBOLS OF INDIA**\n\n` +
        `• **National Animal:** **Royal Bengal Tiger** (*Panthera tigris*) — Adopted in 1973 (replacing the Asiatic Lion) to spotlight critical conservation needs.\n` +
        `• **National Bird:** **Indian Peafowl / Peacock** (*Pavo cristatus*) — Declared in 1963 for its beauty, rich cultural heritage, and country-wide distribution.\n` +
        `• **National Heritage Animal:** **Asian Elephant** (*Elephas maximus*) — Designated in 2010 to strengthen elephant corridor preservation.\n` +
        `• **National Aquatic Animal:** **Gangetic River Dolphin** (*Platanista gangetica*) — Adopted in 2009; a blind, echolocating freshwater dolphin residing in the Ganga-Brahmaputra basin.\n` +
        `• **National Reptile:** **King Cobra** (*Ophiophagus hannah*) — The world's longest venomous snake.\n` +
        `• **Project Tiger:** India's flagship conservation initiative launched in 1973 from Jim Corbett NP.`,
      chips: ['Bengal Tiger Profile', 'Asian Elephant', 'King Cobra SOP', 'Project Tiger']
    },
    {
      id: 'animal_lifespans',
      keywords: [
        'lifespan', 'how long do tigers live', 'how long do animals live',
        'tiger lifespan', 'elephant lifespan', 'lion lifespan', 'how long does a tiger live',
        'how long does an elephant live', 'life expectancy of wild animals', 'animal age'
      ],
      title: 'How long do wild animals live?',
      text: `⏳ **LIFESPANS OF MAJOR WILDLIFE SPECIES**\n\n` +
        `• **Asian Elephant:** 60 to 70 years (similar to humans; can live 75+ in sanctuaries).\n` +
        `• **Bengal Tiger:** 10 to 15 years in the wild (harsh territorial fights reduce lifespan); up to 20 years in captivity.\n` +
        `• **Asiatic Lion:** 12 to 16 years in the wild; up to 20 years in protected captivity.\n` +
        `• **Indian Leopard:** 12 to 15 years in the wild; up to 18 years in captivity.\n` +
        `• **Greater One-Horned Rhino:** 35 to 45 years.\n` +
        `• **Sloth Bear:** 15 to 20 years in the wild; up to 30 years in captivity.\n` +
        `• **King Cobra:** 20 or more years in the wild.`,
      chips: ['Tiger Facts', 'Elephant Speed', 'Rhino Intel', 'Sloth Bear SOP']
    },
    {
      id: 'elephant_ears',
      keywords: [
        'elephant ears', 'why do elephants have big ears', 'why elephant ears are big',
        'big ears of elephant', 'why do elephants flap their ears'
      ],
      title: 'Why do elephants have such big ears?',
      text: `🐘 **THE BIOLOGY BEHIND ELEPHANT EARS**\n\n` +
        `• **Natural Air Conditioners:** Elephants do not have sweat glands. Their large, paper-thin ear flaps contain an intricate network of thousands of tiny blood capillaries.\n` +
        `• **Flapping Mechanism:** When an elephant flaps its ears, the breeze cools the blood flowing through these capillaries by up to 5°C (9°F), which then recirculates through the body to lower core body temperature!\n` +
        `• **Communication & Threat Display:** Spreading the ears wide makes the elephant look vastly larger and intimidating to potential predators or rival bulls.\n` +
        `• **Auditory Detection:** Large ear concavities channel low-frequency infrasonic rumbles across distances of up to 10 kilometers.`,
      chips: ['Asian Elephant', 'Elephant Corridors', 'Elephant Speed']
    },
    {
      id: 'venom_vs_poison',
      keywords: [
        'venom vs poison', 'poison vs venom', 'difference between venom and poison',
        'is snake venomous or poisonous', 'venomous or poisonous', 'poison or venom'
      ],
      title: 'What is the difference between venom and poison?',
      text: `🧪 **VENOM vs. POISON: TOXIN DELIVERY MECHANISM**\n\n` +
        `The difference lies entirely in **how the toxin is delivered** into your body:\n\n` +
        `• **Venom is INJECTED:** Venomous animals use specialized structures (fangs, stingers, spines) to inject toxins actively into wounds or the bloodstream (e.g. Cobras, Vipers, Scorpions, Wasps).\n` +
        `  *Rule of Thumb: If it bites or stings you and you get sick, it's venomous!*\n\n` +
        `• **Poison is INGESTED, INHALED, or ABSORBED:** Poisonous organisms deliver toxins passively through skin contact, swallowing, or breathing (e.g. Poison Dart Frogs, Fugu Pufferfish, toxic mushrooms).\n` +
        `  *Rule of Thumb: If you bite or touch it and you get sick, it's poisonous!*`,
      chips: ['Big Four Snakes', 'Snakebite Protocol', 'King Cobra SOP']
    },
    {
      id: 'croc_vs_alligator',
      keywords: [
        'crocodile vs alligator', 'alligator vs crocodile', 'difference between crocodile and alligator',
        'alligators or crocodiles'
      ],
      title: 'Difference between Crocodiles and Alligators',
      text: `🐊 **CROCODILE vs. ALLIGATOR: HOW TO TELL THEM APART**\n\n` +
        `• **Snout Shape:** Crocodiles have a pointed, narrow **V-shaped snout**; alligators have a wide, rounded **U-shaped snout**.\n` +
        `• **Tooth Visibility:** When a crocodile closes its mouth, the large **4th lower tooth remains clearly visible** pointing upward on the outside of the upper jaw. In alligators, lower teeth fit into sockets and are hidden.\n` +
        `• **Salt Tolerance:** Crocodiles possess specialized lingual salt glands on their tongues that excrete excess salt, allowing them to thrive in mangrove estuaries and oceans (like the Saltwater Crocodile). Alligators lack functioning salt glands and live primarily in freshwater swamps.\n` +
        `• **Geography:** India has 3 native crocodilian species (Mugger, Gharial, Saltwater Crocodile); **Alligators are NOT native to India** (they live only in the Americas and China).`,
      chips: ['Crocodile Safety', 'Sundarbans Delta', 'River Crossing SOP']
    },
    {
      id: 'black_panther_fact',
      keywords: [
        'black panther', 'what is a black panther', 'is black panther a species',
        'melanistic leopard', 'black leopard'
      ],
      title: 'What is a Black Panther? Is it a separate species?',
      text: `🐆 **THE TRUTH ABOUT BLACK PANTHERS**\n\n` +
        `• **Not a Distinct Species:** A "Black Panther" is NOT a separate biological species!\n` +
        `• **Melanism (Color Mutation):** It is simply a regular **Leopard** (*Panthera pardus*) in Asia/Africa, or a **Jaguar** (*Panthera onca*) in the Americas, with **melanism** — an excess of dark melanin pigment caused by a recessive gene allele.\n` +
        `• **Ghost Spots:** If you shine a bright flashlight or sunlight on a black panther's coat, you can clearly see the classic rosette ring patterns hidden beneath the dark sheen.\n` +
        `• **Where in India?** Famous black leopards roam the dense rainforests of Kabini (Nagarhole NP, Karnataka), Anamalai, and the Western Ghats where deep canopy shadows favor dark camouflage.`,
      chips: ['Leopard Intel', 'Western Ghats', 'Tiger Facts']
    },
    {
      id: 'tiger_swim',
      keywords: [
        'can tigers swim', 'do tigers swim', 'tigers like water', 'do tigers like water',
        'tiger swimming', 'can tiger swim'
      ],
      title: 'Can tigers swim? Do they like water?',
      text: `🏊 **TIGERS AND WATER: NATURE'S SWIMMING CATS**\n\n` +
        `• **Love for Water:** Unlike domestic house cats and lions who generally avoid deep water, Bengal tigers **love water and are outstanding swimmers**.\n` +
        `• **Thermoregulation:** In the blistering 45°C (113°F) heat of Indian summers, tigers spend hours submerged up to their necks in jungle pools, lakes, and rivers to cool down.\n` +
        `• **Sundarbans Sea Swimmers:** In the Sundarbans mangrove delta, tigers regularly swim across **4 to 7-kilometer-wide tidal sea rivers** with swift currents, hunting on delta islands and boarding fishing trawlers.\n` +
        `• **Webbed Paws:** Tigers have slight webbing between their toe pads, providing hydrodynamic propulsion and silent maneuvering in water.`,
      chips: ['Sundarbans Delta', 'Tiger Facts', 'Pugmark Identification']
    },
    {
      id: 'leopard_trees',
      keywords: [
        'why do leopards climb trees', 'leopards climb trees', 'leopard in tree',
        'why do leopards carry prey up trees', 'leopard tree'
      ],
      title: 'Why do leopards climb and hoist prey into trees?',
      text: `🌳 **WHY DO LEOPARDS LIVE & HUNT IN TREES?**\n\n` +
        `• **Hoisting Prey Away from Rivals:** In the jungle, ground scavengers and stronger apex predators (Bengal tigers, hyenas, and dhole wild dog packs) routinely steal leopard kills (kleptoparasitism). A leopard hoists carcasses weighing up to **3x its own body weight** into tree forks to feed at leisure.\n` +
        `• **Supreme Anatomy:** Retractile curved claws, strong scapular muscles, and long balancing tails make leopards the most arboreal of all big cats.\n` +
        `• **Canopy Ambush & Vantage:** Tree branches give leopards a 360-degree surveillance view over jungle trails and provide shaded, insect-free resting perches during the heat of the day.`,
      chips: ['Leopard Intel', 'Tree Ambush Defense', 'Tiger vs Lion']
    },
    {
      id: 'earthquake_animals',
      keywords: [
        'animals sense earthquake', 'can animals sense earthquakes', 'animals predict tsunami',
        'animals sense disaster', 'sixth sense animals'
      ],
      title: 'Can animals sense earthquakes and tsunamis before humans?',
      text: `⚡ **HOW ANIMALS DETECT NATURAL DISASTERS**\n\n` +
        `• **Seismic P-Wave Detection:** Earthquakes produce two types of waves: fast-moving, low-amplitude **Primary (P) waves** followed by destructive **Secondary (S) waves**. Many animals detect tiny P-waves seconds to minutes before the violent surface shaking begins.\n` +
        `• **Infrasound Sensitivity:** Asian Elephants have specialized mechanoreceptors (Pacinian corpuscles) in their foot pads and trunk tips that register deep underground infrasonic tremors.\n` +
        `• **The 2004 Tsunami Phenomenon:** During the 2004 Indian Ocean Tsunami, elephants in Sri Lanka and Thailand broke their chains and ran for high ground, and flamingos abandoned low-lying coastal nests hours before giant waves struck shore.\n` +
        `• **Atmospheric & Barometric Sensitivity:** Birds and snakes sense shifts in barometric air pressure and electrostatic charges in air ions, causing mass sudden exodus before tropical cyclones.`,
      chips: ['Asian Elephant', 'Snake Senses', 'Jungle Navigation']
    },
    {
      id: 'bite_force',
      keywords: [
        'bite force', 'strongest bite', 'who has the strongest bite', 'highest bite force',
        'tiger bite force', 'lion bite force', 'bite force of animals'
      ],
      title: 'Which animal has the strongest bite force?',
      text: `🦷 **ANIMAL KINGDOM BITE FORCE RANKINGS**\n\n` +
        `• **Saltwater Crocodile:** **~3,700 PSI** (Pounds per Square Inch) — the strongest measured bite force of any living creature today, capable of crushing turtle shells and buffalo bones.\n` +
        `• **Great White Shark:** Estimated **~4,000 PSI**.\n` +
        `• **Hippopotamus:** **~12,600 Newtons (~1,800 PSI)** — can snap a small boat in two.\n` +
        `• **Jaguar:** **~1,500 PSI** — strongest bite of any big cat relative to body mass; kills by piercing the temporal bones of the skull directly into the brain.\n` +
        `• **Bengal Tiger:** **~1,050 PSI** — sufficient to snap bovine spines and sever trachea in seconds.\n` +
        `• **Spotted Hyena:** **~1,100 PSI** — built for bone pulverization.\n` +
        `• **Lion:** **~650 PSI**.\n` +
        `• **Human Comparison:** An adult human bites with approximately **120–160 PSI**.`,
      chips: ['Saltwater Crocodile', 'Bengal Tiger Profile', 'Tiger vs Lion']
    },
    {
      id: 'cheetah_vs_leopard',
      keywords: [
        'cheetah vs leopard', 'leopard vs cheetah', 'difference between cheetah and leopard',
        'how to tell cheetah and leopard apart'
      ],
      title: 'Difference between Cheetah and Leopard',
      text: `🐆 **CHEETAH vs. LEOPARD: HOW TO IDENTIFY THEM**\n\n` +
        `• **Coat Patterns:**\n` +
        `  - **Cheetah:** Covered in solid, round, distinct **single black spots**.\n` +
        `  - **Leopard:** Covered in intricate flower-like **rosettes** (clusters of spots encircling a darker gold center).\n` +
        `• **Facial Markings:** Cheetahs have prominent black **"tear line" tracks** from the inner eyes down to the mouth; leopards have no tear tracks.\n` +
        `• **Build & Strength:**\n` +
        `  - **Cheetah:** Greyhound-like, slender, high-speed sprinter (120 km/h), small canines, cannot climb trees easily.\n` +
        `  - **Leopard:** Stocky, heavily muscled powerhouse, master tree climber that hoists 100-kg carcasses up vertical trunks.\n` +
        `• **Hunting Times:** Cheetahs hunt by day (diurnal) using pure speed; Leopards hunt by night/twilight (nocturnal/crepuscular) using silent stealth ambush.`,
      chips: ['Project Cheetah (Kuno)', 'Leopard Intel', 'Fastest Animals']
    },
    {
      id: 'why_stripes',
      keywords: ['why stripes', 'stripes on tiger', 'tiger stripes', 'why do tigers have stripes', 'why tigers have stripes', 'why are tigers striped', 'tiger stripe'],
      title: 'Why do tigers have stripes?',
      text: `🐅 **WHY DO TIGERS HAVE STRIPES?**\n\n` +
        `Tigers possess stripes for **disruptive camouflage**:\n\n` +
        `• **Optical Illusion:** The vertical stripes break up the solid outline of the tiger\'s body amidst tall elephant grass, bamboo, and dappled sunbeams.\n` +
        `• **Color Blindness of Prey:** Most ungulate prey (deer, chital, gaur) are dichromatic (they lack red photoreceptor cones and perceive orange as dull olive-green). To a deer, an orange-and-black tiger blends seamlessly into green vegetation!\n` +
        `• **Skin-Deep Pattern:** A tiger\'s stripes are not just on its fur — if shaved, the identical stripe pattern is pigmented directly into its skin.`,
      chips: ['Bengal Tiger Profile', 'Pugmark Identification', 'Tiger vs Lion']
    },
    {
      id: 'antlers_vs_horns',
      keywords: ['antlers vs horns', 'difference between horns and antlers', 'horns and antlers', 'antler vs horn', 'difference between antler and horn', 'antlers or horns'],
      title: 'What is the difference between horns and antlers?',
      text: `🦌 **HORNS vs. ANTLERS: KEY BIOLOGICAL DIFFERENCES**\n\n` +
        `• **Antlers (Deer Family - Cervidae):**\n` +
        `  - Made of pure solid bone.\n` +
        `  - Shed and regrown completely every year (e.g. Sambar, Chital, Barasingha).\n` +
        `  - Covered in a nutrient-rich, vascular skin called "velvet" while growing.\n` +
        `  - Usually grown only by males (exception: caribou/reindeer).\n\n` +
        `• **Horns (Bovine & Antelope Family - Bovidae):**\n` +
        `  - Have a permanent living bony core covered by a sheath of keratin.\n` +
        `  - Permanent structures that are NEVER shed (e.g. Gaur, Blackbuck, Nilgai, Wild Water Buffalo).\n` +
        `  - Continue growing throughout the animal\'s lifetime.`,
      chips: ['Indian Gaur', 'Tiger Prey Dynamics', 'Herbivore Ecology']
    },
    {
      id: 'elephant_speed',
      keywords: ['how fast elephant', 'elephant run speed', 'elephant speed', 'how fast can an elephant', 'how fast do elephants run', 'can elephant run fast'],
      title: 'How fast can an elephant run?',
      text: `🐘 **ELEPHANT LOCOMOTION & SPEED**\n\n` +
        `• **Top Speed:** An adult Asian elephant can charge at **25 to 40 km/h (15–25 mph)**.\n` +
        `• **Can an elephant jump?** No. Elephants are one of the few mammals that cannot jump. Their lower limb bones lack spring mechanics, and they must always keep at least one foot on the ground.\n` +
        `• **Human Comparison:** Olympic sprinter Usain Bolt tops out at 44 km/h; an average human runs 15–20 km/h. **An angry elephant can easily outrun a normal human in a straight sprint.** Always run diagonally, downhill through dense trees, or climb.`,
      chips: ['Asian Elephant', 'Elephant Corridors', 'Elephant Safety SOP']
    },
    {
      id: 'snake_senses',
      keywords: ['snakes hear', 'can snakes hear', 'how do snakes smell', 'how do snakes hear', 'do snakes have ears', 'snake hearing', 'how snakes smell'],
      title: 'How do snakes hear and smell?',
      text: `🐍 **HOW SNAKES DETECT SOUND & SCENT**\n\n` +
        `• **Hearing Without External Ears:** Snakes lack eardrums and external ear openings. However, their quadrate jawbone is connected directly to the inner ear bone (stapes). They detect low-frequency airborne sounds and ground vibrations effortlessly through mechanoreception.\n` +
        `• **Smelling with the Tongue:** When a snake flicks its forked tongue, it captures microscopic scent molecules from the air and transfers them to the **Jacobson\'s Organ (Vomeronasal Organ)** on the roof of its mouth for chemical analysis.`,
      chips: ['Big Four Snakes', 'King Cobra SOP', 'Snakebite Protocol']
    },
    {
      id: 'activity_cycles',
      keywords: ['nocturnal', 'diurnal', 'crepuscular', 'activity patterns', 'what is nocturnal', 'what is crepuscular'],
      title: 'Nocturnal vs Diurnal vs Crepuscular Animals',
      text: `🌓 **ANIMAL CHRONOBIOLOGY & ACTIVITY CYCLES**\n\n` +
        `• **Diurnal:** Active during daylight hours (e.g. Langurs, Peafowl, Hornbills, Indian Rhinos).\n` +
        `• **Nocturnal:** Active during nighttime darkness (e.g. Common Krait, Indian Pangolin, Sloth Bear, Flying Squirrels, Owls).\n` +
        `• **Crepuscular:** Active primarily during twilight hours (dawn and dusk) when temperatures cool and light levels shift (e.g. Tigers, Leopards, Chital, Sambar, Jackals).`,
      chips: ['Tiger Facts', 'Sloth Bear SOP', 'Night Patrol Protocols']
    },
    {
      id: 'project_tiger',
      keywords: ['project tiger', 'when was project tiger started', 'project elephant', 'wildlife protection act', 'wpa 1972'],
      title: 'Project Tiger & Project Elephant in India',
      text: `🐅 **PROJECT TIGER & WILDLIFE CONSERVATION IN INDIA**\n\n` +
        `• **Project Tiger (1973):** Launched on April 1, 1973, under Prime Minister Indira Gandhi from Corbett National Park. It created dedicated Tiger Reserves with core inviolate zones and buffer multi-use zones. India now harbors over 75% of the world\'s wild tigers (3,600+ individuals).\n` +
        `• **Project Elephant (1992):** Centered on ecological connectivity, mitigating human-elephant conflict, and establishing legal protection for 100+ identified interstate elephant corridors.\n` +
        `• **Wildlife Protection Act (1972):** The supreme legal statute providing Schedule I top-tier protection to endangered species like Tigers, Snow Leopards, Elephants, Rhinos, and Pangolins.`,
      chips: ['Bengal Tiger Profile', 'Corbett Reserve', 'Elephant Corridors']
    }
  ];

  // ==========================================================================
  // CONTEXT EXTRACTION FROM LIVE DASHBOARD
  // ==========================================================================
  function getLiveSystemContext() {
    const fw = (typeof window !== 'undefined' ? window.FieldWatch : null) || {};
    const detections = (typeof fw.getDetections === 'function' ? fw.getDetections() : []) || [];
    const radar = (typeof fw.getRadarState === 'function' ? fw.getRadarState() : null) || {};
    const researcher = (typeof fw.getCurrentResearcher === 'function' ? fw.getCurrentResearcher() : null) || {};
    const alarmArmed = typeof fw.isAlarmArmed === 'function' ? fw.isAlarmArmed() : true;

    // Filter today's predators
    const predators = detections.filter(d => {
      const a = (d.animal || '').toLowerCase();
      const s = (d.species || '').toLowerCase();
      return a.includes('tiger') || a.includes('leopard') || a.includes('bear') || 
             s.includes('panthera') || s.includes('melursus') || d.tone === 'danger';
    });

    return {
      station: researcher.station || 'Kolkata Station (Node 04)',
      researcherName: researcher.name || 'Arkasnata Bandyopadhyay',
      researcherRole: researcher.role || 'Lead Field Researcher',
      totalDetections: detections.length,
      recentDetections: detections.slice(0, 5),
      predatorsDetected: predators,
      radarActive: Boolean(radar.isActive),
      radarDistanceCm: radar.currentDistance || null,
      radarAngle: radar.currentAngle || 90,
      radarObstacle: Boolean(radar.isObstacle),
      radarSource: radar.source || 'Offline',
      alarmArmed
    };
  }

  // ==========================================================================
  // ENCYCLOPEDIC & TACTICAL SEARCH ENGINE
  // ==========================================================================
  function searchWildlifeIntelligence(q) {
    const query = q.toLowerCase().trim();

    // 1. High-Priority Semantic Intent Checks:
    // A. King of the Jungle / Forest queries
    if ((query.includes('king') || query.includes('ruler') || query.includes('monarch') || query.includes('boss')) &&
        (query.includes('jungle') || query.includes('forest') || query.includes('beast') || query.includes('wild') || query.includes('animal') || query.includes('pride'))) {
      const k = WILDLIFE_FAQS.find(f => f.id === 'king_of_jungle');
      if (k) return { text: k.text, alertType: 'info', chips: k.chips };
    }

    // B. Tiger vs Lion queries
    if ((query.includes('tiger') && query.includes('lion')) ||
        ((query.includes('who would win') || query.includes('who wins') || query.includes('who is stronger') || query.includes('fight') || query.includes('battle')) && 
         (query.includes('tiger') || query.includes('lion') || query.includes('cat')))) {
      const tvl = WILDLIFE_FAQS.find(f => f.id === 'tiger_vs_lion');
      if (tvl) return { text: tvl.text, alertType: 'info', chips: tvl.chips };
    }

    // C. Fastest animals / speed records
    if (query.includes('fastest') || (query.includes('speed') && (query.includes('highest') || query.includes('top') || query.includes('world') || query.includes('record') || query.includes('land')))) {
      const fst = WILDLIFE_FAQS.find(f => f.id === 'fastest_animals');
      if (fst) return { text: fst.text, alertType: 'info', chips: fst.chips };
    }

    // D. Largest / biggest animals
    if (query.includes('biggest') || query.includes('largest') || query.includes('heaviest') || (query.includes('giant') && query.includes('animal'))) {
      const lrg = WILDLIFE_FAQS.find(f => f.id === 'largest_animals');
      if (lrg) return { text: lrg.text, alertType: 'info', chips: lrg.chips };
    }

    // E. Deadliest / most dangerous animals
    if (query.includes('deadliest') || query.includes('most dangerous') || query.includes('most lethal') || query.includes('kills the most') || query.includes('most deadly')) {
      const ddl = WILDLIFE_FAQS.find(f => f.id === 'deadliest_animals');
      if (ddl) return { text: ddl.text, alertType: 'danger', chips: ddl.chips };
    }

    // F. National symbols / National animal of India
    if (query.includes('national animal') || query.includes('national bird') || query.includes('national symbol') || query.includes('national reptile') || query.includes('national aquatic') || query.includes('national heritage') || (query.includes('national') && (query.includes('india') || query.includes('symbol')))) {
      const nat = WILDLIFE_FAQS.find(f => f.id === 'national_symbols');
      if (nat) return { text: nat.text, alertType: 'info', chips: nat.chips };
    }

    // G. Lifespan queries
    if (query.includes('lifespan') || query.includes('how long do') || query.includes('how long does') || query.includes('life expectancy') || query.includes('how old do')) {
      const lsp = WILDLIFE_FAQS.find(f => f.id === 'animal_lifespans');
      if (lsp) return { text: lsp.text, alertType: 'info', chips: lsp.chips };
    }

    // H. Bite Force queries
    if (query.includes('bite force') || (query.includes('strongest') && (query.includes('bite') || query.includes('jaw') || query.includes('teeth')))) {
      const bf = WILDLIFE_FAQS.find(f => f.id === 'bite_force');
      if (bf) return { text: bf.text, alertType: 'info', chips: bf.chips };
    }

    // 2. Check specific General Biology & Wildlife FAQs keywords
    for (const faq of WILDLIFE_FAQS) {
      if (faq.keywords && faq.keywords.some(kw => query.includes(kw))) {
        return {
          text: faq.text,
          alertType: 'info',
          chips: faq.chips || ['Tiger Facts', 'Elephant Speed', 'Snakebite Protocol', 'National Parks']
        };
      }
    }

    // 3. Check Jungle Survival & First Aid Topics
    if (query.includes('water') || query.includes('drink') || query.includes('thirst') || query.includes('purify') || query.includes('dehydration')) {
      const w = JUNGLE_SURVIVAL.water;
      return {
        text: `${w.title}\n\n` + w.content.join('\n\n'),
        alertType: 'info',
        chips: w.chips
      };
    }

    if (query.includes('navigation') || query.includes('lost in') || query.includes('compass') || query.includes('direction') || query.includes('find north') || query.includes('lost in jungle')) {
      const n = JUNGLE_SURVIVAL.navigation;
      return {
        text: `${n.title}\n\n` + n.content.join('\n\n'),
        alertType: 'info',
        chips: n.chips
      };
    }

    if (query.includes('leech') || query.includes('leeches') || query.includes('tick') || query.includes('insect bite') || query.includes('bug bite')) {
      const l = JUNGLE_SURVIVAL.leeches;
      return {
        text: `${l.title}\n\n` + l.content.join('\n\n'),
        alertType: 'warning',
        chips: l.chips
      };
    }

    if (query.includes('snakebite') || query.includes('snake bite') || query.includes('antivenom') || query.includes('bitten by snake') || query.includes('snake venom') || query.includes('bitten by a snake')) {
      const sb = JUNGLE_SURVIVAL.snakebite;
      return {
        text: `${sb.title}\n\n` + sb.content.join('\n\n'),
        alertType: 'danger',
        chips: sb.chips
      };
    }

    if (query.includes('shelter') || query.includes('camp') || query.includes('lean-to') || query.includes('sleeping in jungle') || query.includes('night in jungle')) {
      const sh = JUNGLE_SURVIVAL.shelter;
      return {
        text: `${sh.title}\n\n` + sh.content.join('\n\n'),
        alertType: 'info',
        chips: sh.chips
      };
    }

    // 4. Check National Parks, Biomes & Ecology Topics
    if (query.includes('sundarban') || query.includes('mangrove') || query.includes('delta')) {
      const su = FOREST_ECOLOGY.sundarbans;
      return {
        text: `${su.title}\n\n` + su.content.join('\n\n'),
        alertType: 'info',
        chips: su.chips
      };
    }

    if (query.includes('kaziranga') || query.includes('rhino park') || query.includes('assam grassland')) {
      const kz = FOREST_ECOLOGY.kaziranga;
      return {
        text: `${kz.title}\n\n` + kz.content.join('\n\n'),
        alertType: 'info',
        chips: kz.chips
      };
    }

    if (query.includes('corbett') || query.includes('jim corbett')) {
      const jc = FOREST_ECOLOGY.corbett;
      return {
        text: `${jc.title}\n\n` + jc.content.join('\n\n'),
        alertType: 'info',
        chips: jc.chips
      };
    }

    if (query.includes('ranthambore') || query.includes('ranthambhor')) {
      const rt = FOREST_ECOLOGY.ranthambore;
      return {
        text: `${rt.title}\n\n` + rt.content.join('\n\n'),
        alertType: 'info',
        chips: rt.chips
      };
    }

    if (query.includes('western ghat') || query.includes('shola') || query.includes('rainforest') || query.includes('biodiversity hotspot')) {
      const wg = FOREST_ECOLOGY.western_ghats;
      return {
        text: `${wg.title}\n\n` + wg.content.join('\n\n'),
        alertType: 'info',
        chips: wg.chips
      };
    }

    if (query.includes('pugmark') || query.includes('track') || query.includes('paw print') || query.includes('footprint') || query.includes('animal footprint')) {
      const pm = FOREST_ECOLOGY.pugmark;
      return {
        text: `${pm.title}\n\n` + pm.content.join('\n\n'),
        alertType: 'info',
        chips: pm.chips
      };
    }

    if (query.includes('corridor') || query.includes('hwc') || query.includes('conflict') || query.includes('bio fence') || query.includes('beehive fence')) {
      const co = FOREST_ECOLOGY.corridors;
      return {
        text: `${co.title}\n\n` + co.content.join('\n\n'),
        alertType: 'info',
        chips: co.chips
      };
    }

    // 5. Dynamic Property Extraction for Specific Species (Diet, Speed, Habitat, Weight, Safety)
    const sortedSpecies = [...WILDLIFE_SPECIES].sort((a, b) => {
      const maxA = Math.max(...a.aliases.map(al => al.length));
      const maxB = Math.max(...b.aliases.map(al => al.length));
      return maxB - maxA;
    });

    for (const sp of sortedSpecies) {
      const sortedAliases = [...sp.aliases].sort((a, b) => b.length - a.length);
      const isMatched = sortedAliases.some(alias => query.includes(alias));
      if (!isMatched) continue;

      // Query asking for diet / what does it eat
      if (query.includes('diet') || query.includes('eat') || query.includes('food') || query.includes('prey') || query.includes('feed') || query.includes('consume')) {
        return {
          text: `🍽️ **DIET & FEEDING ECOLOGY: ${sp.name.toUpperCase()}**\n\n` +
            `• **Dietary Profile:** ${sp.diet}\n\n` +
            `**Zoological Context:**\n` +
            (sp.facts && sp.facts.length > 0 ? `• ${sp.facts[0]}\n` : '') +
            `• **Native Habitat Range:** ${sp.habitat}`,
          alertType: 'info',
          chips: [sp.name.split(' ')[0] + ' Facts', sp.name.split(' ')[0] + ' Speed', 'Tiger Prey Dynamics']
        };
      }

      // Query asking for speed / running
      if (query.includes('speed') || query.includes('fast') || query.includes('run') || query.includes('sprint') || query.includes('velocity')) {
        return {
          text: `⚡ **SPEED & MOBILITY: ${sp.name.toUpperCase()}**\n\n` +
            `• **Top Speed / Locomotion:** ${sp.speed || 'Not officially benchmarked'}\n\n` +
            `**Physical Profile:**\n` +
            `• **Dimensions & Weight:** ${sp.weight || sp.length || 'N/A'}\n` +
            `• **Primary Habitat:** ${sp.habitat}`,
          alertType: 'info',
          chips: [sp.name.split(' ')[0] + ' Diet', 'Fastest Animals', 'Tiger vs Lion']
        };
      }

      // Query asking for habitat / where does it live
      if (query.includes('habitat') || query.includes('where do') || query.includes('where does') || query.includes('live') || query.includes('found in') || query.includes('range') || query.includes('reside')) {
        return {
          text: `🌿 **HABITAT & BIOME: ${sp.name.toUpperCase()}**\n\n` +
            `• **Geographic Range & Forests:** ${sp.habitat}\n\n` +
            `• **Threat / IUCN Status:** ${sp.iucn || sp.threatLevel || 'Protected'}\n` +
            (sp.facts && sp.facts.length > 1 ? `• **Field Fact:** ${sp.facts[1]}` : ''),
          alertType: 'info',
          chips: [sp.name.split(' ')[0] + ' Facts', 'Sundarbans Delta', 'Kaziranga Grasslands']
        };
      }

      // Query asking for weight / size / height
      if (query.includes('weight') || query.includes('how heavy') || query.includes('size') || query.includes('dimensions') || query.includes('length') || query.includes('height') || query.includes('how big')) {
        return {
          text: `⚖️ **PHYSICAL SPECIFICATIONS: ${sp.name.toUpperCase()}**\n\n` +
            `• **Weight / Mass:** ${sp.weight || sp.length || 'N/A'}\n` +
            `• **Mobility & Speed:** ${sp.speed || 'N/A'}\n\n` +
            `**Key Zoological Fact:**\n` +
            (sp.facts && sp.facts.length > 0 ? `• ${sp.facts[0]}` : ''),
          alertType: 'info',
          chips: [sp.name.split(' ')[0] + ' Facts', 'Largest Animals', 'Tiger vs Lion']
        };
      }

      // Query asking for safety / encounter / attack / defense
      if (query.includes('safe') || query.includes('attack') || query.includes('defend') || query.includes('danger') || query.includes('sop') || query.includes('encounter') || query.includes('survive')) {
        let reply = `🛡️ **FIELD SAFETY & ENCOUNTER PROTOCOL: ${sp.name.toUpperCase()}**\n\n`;
        reply += `• **Threat Classification:** [${sp.threatLevel || 'MODERATE'}]\n\n`;
        if (Array.isArray(sp.sop) && sp.sop.length > 0) {
          reply += `**Tactical Action Rules:**\n`;
          sp.sop.forEach(s => { reply += `• ${s}\n`; });
        } else {
          reply += `• Maintain at least 100 meters standoff distance.\n• Never corner or surprise the animal in dense vegetation.\n`;
        }
        return {
          text: reply,
          alertType: sp.threatLevel === 'CRITICAL' || sp.threatLevel === 'HIGH' ? 'danger' : 'warning',
          chips: ['Sound Alarm', 'Predator Status', sp.name.split(' ')[0] + ' Facts']
        };
      }

      // Default: Full species profile
      let reply = `🐾 **${sp.name.toUpperCase()}**\n\n`;
      if (sp.threatLevel) reply += `• **Threat Level:** [${sp.threatLevel}]\n`;
      if (sp.iucn) reply += `• **Conservation Status:** ${sp.iucn}\n`;
      if (sp.habitat) reply += `• **Habitat:** ${sp.habitat}\n`;
      if (sp.diet) reply += `• **Diet & Prey:** ${sp.diet}\n`;
      if (sp.speed) reply += `• **Speed & Mobility:** ${sp.speed}\n`;
      if (sp.weight) reply += `• **Physical Dimensions:** ${sp.weight}\n`;

      if (Array.isArray(sp.facts) && sp.facts.length > 0) {
        reply += `\n**Key Zoological Facts:**\n`;
        sp.facts.forEach(f => { reply += `• ${f}\n`; });
      }

      if (Array.isArray(sp.sop) && sp.sop.length > 0) {
        reply += `\n**Standing Field SOP & Safety:**\n`;
        sp.sop.forEach(s => { reply += `🛡️ ${s}\n`; });
      }

      return {
        text: reply,
        alertType: sp.threatLevel === 'CRITICAL' || sp.threatLevel === 'HIGH' ? 'danger' : 'info',
        chips: sp.chips || ['Recent Sightings', 'Predator Status', 'Radar Telemetry']
      };
    }

    return null;
  }

  // ==========================================================================
  // LOCAL OFFLINE TACTICAL RULE ENGINE
  // ==========================================================================
  function generateLocalTacticalReply(query) {
    const q = query.trim().toLowerCase();
    const ctx = getLiveSystemContext();

    // 1. FIRST: Check Comprehensive Wildlife & Jungle Knowledge Base
    const wildlifeMatch = searchWildlifeIntelligence(q);
    if (wildlifeMatch) {
      return wildlifeMatch;
    }

    // 2. GREETINGS & CASUAL INTERACTION
    if (q === 'hi' || q === 'hello' || q === 'hey' || q.startsWith('hi ') || q.startsWith('hello ') || q.startsWith('hey ') || q.includes('good morning') || q.includes('good evening') || q.includes('namaste') || q === 'sup' || q === 'yo') {
      return {
        text: `👋 **GREETINGS, OFFICER!**\n\n` +
          `Ranger AI Field Tactical Copilot online and standing by at **${ctx.station}**.\n\n` +
          `- Perimeter Status: **${ctx.alarmArmed ? 'Armed & Monitoring' : 'Standby'}**\n` +
          `- Ultrasonic Radar: **${ctx.radarActive ? 'Active 180° Sweep' : 'Standby'}**\n` +
          `- Field Records: **${ctx.totalDetections} logged sightings**\n\n` +
          `How can I assist your field operations, zoological research, or survival readiness today?`,
        alertType: 'success',
        chips: ['👑 King of Jungle', '🥊 Tiger vs Lion', '🐅 Tiger Facts', '💧 Water in Jungle', '🚨 Predator Status']
      };
    }

    // 3. GRATITUDE & ACKNOWLEDGMENT
    if (q.includes('thank') || q.includes('thanks') || q.includes('good job') || q.includes('awesome') || q.includes('well done') || q.includes('great work') || q.includes('nice')) {
      return {
        text: `🌲 **AT YOUR SERVICE, RANGER!**\n\n` +
          `Always maintain situational awareness in the field. Let me know whenever you need species diagnostics, tracking advice, or console hardware telemetry.`,
        alertType: 'success',
        chips: ['Tiger Facts', 'Radar Telemetry', 'Predator Status', 'Sundarbans Delta']
      };
    }

    // 3.5. GEOSPATIAL & LOCATION INQUIRIES
    if (q.includes('where am i') || q.includes('my location') || q.includes('gps location') || q.includes('coordinates') || q.includes('google maps') || q.includes('station location') || q.includes('show location')) {
      const loc = (window.FieldWatch && typeof window.FieldWatch.getCurrentLocation === 'function') ? window.FieldWatch.getCurrentLocation() : null;
      if (loc) {
        const lat = Number(loc.latitude).toFixed(6);
        const lon = Number(loc.longitude).toFixed(6);
        const place = loc.displayName || loc.formattedAddress || loc.city || 'Field Station Node 04';
        const gmapsLink = `https://www.google.com/maps?q=${lat},${lon}&z=17&t=k`;

        return {
          text: `📍 **CURRENT FIELD STATION & LAPTOP GPS LOCATION**\n\n` +
            `• **Coordinates:** \`${lat}° N, ${lon}° E\`\n` +
            `• **Resolved Area:** **${place}**\n` +
            `• **Accuracy:** ±${Math.round(loc.accuracy || 15)} meters\n` +
            `• **Altitude:** ${loc.altitude || '32 m MSL'}\n` +
            `• **Source:** ${loc.source || 'Laptop GPS (Windows / Browser)'}\n\n` +
            `[🛰️ Open Exact Pin in Google Maps](${gmapsLink})`,
          alertType: 'success',
          actions: [
            { label: '🗺️ Open Google Maps', command: 'show map' },
            { label: '⚙️ Calibrate Station', command: 'calibrate' }
          ],
          chips: ['Show Map', 'Latest Sightings', 'Radar Telemetry']
        };
      }
    }

    // 4. SIREN / ALARM COMMANDS
    if (q.includes('siren on') || q.includes('arm siren') || q.includes('turn on siren') || q.includes('enable alarm') || q.includes('sound alarm') || q.includes('trigger alarm')) {
      if (window.FieldWatch && typeof window.FieldWatch.toggleAlarm === 'function') {
        window.FieldWatch.toggleAlarm(true);
        window.FieldWatch.triggerAlarmSound();
      }
      return {
        text: `🚨 **PREDATOR AUDIO SIREN ARMED & TRIGGERED**\n\n- Siren Status: **ARMED (ACTIVE)**\n- Broadcast: Multi-frequency high-decibel deterrence siren.\n- Safety: Station perimeter beacon is active. All personnel notified.`,
        alertType: 'danger',
        chips: ['Mute Siren', 'Predator Status', 'Recent Sightings']
      };
    }

    if (q.includes('siren off') || q.includes('mute siren') || q.includes('silence') || q.includes('turn off siren') || q.includes('disable alarm')) {
      if (window.FieldWatch && typeof window.FieldWatch.toggleAlarm === 'function') {
        window.FieldWatch.toggleAlarm(false);
      }
      return {
        text: `🔇 **PREDATOR SIREN MUTED**\n\n- Siren Status: **MUTED / STANDBY**\n- Note: Silent visual telemetry and YOLO detection alerts remain fully active.`,
        alertType: 'info',
        chips: ['Arm Siren', 'Radar Telemetry', 'Latest Sightings']
      };
    }

    // 5. CAMERA / WEBCAM COMMANDS
    if (q.includes('refresh camera') || q.includes('refresh feed') || q.includes('reload feed')) {
      if (window.FieldWatch && typeof window.FieldWatch.refreshCameraFeed === 'function') {
        window.FieldWatch.refreshCameraFeed();
      }
      return {
        text: `📷 **CAMERA FEED REFRESHED**\n\n- Node: Node 04 (ESP32-CAM / YOLO)\n- Stream Sync: Updated frame buffers and real-time inference canvas.`,
        alertType: 'success',
        chips: ['Use Laptop Webcam', 'Radar Telemetry']
      };
    }

    if (q.includes('switch to webcam') || q.includes('use webcam') || q.includes('laptop webcam') || q.includes('stop webcam') || q.includes('toggle webcam')) {
      if (window.FieldWatch && typeof window.FieldWatch.toggleLaptopWebcam === 'function') {
        window.FieldWatch.toggleLaptopWebcam();
      }
      return {
        text: `📹 **CAMERA SOURCE TOGGLED**\n\n- Switched primary computer vision input between ESP32-CAM wireless stream and onboard laptop webcam.`,
        alertType: 'info',
        chips: ['Refresh Camera', 'Latest Sightings']
      };
    }

    // 6. LIVE PREDATOR & THREAT INQUIRIES
    if (q.includes('predator') || q.includes('threat') || q.includes('danger') || q.includes('carnivore')) {
      const preds = ctx.predatorsDetected;
      if (preds.length > 0) {
        const topPred = preds[0];
        let reply = `⚠️ **LIVE PREDATOR ACTIVITY DETECTED: [${topPred.animal.toUpperCase()}]**\n\n`;
        reply += `- **Species:** *${topPred.species || 'Unknown'}*\n`;
        reply += `- **Confidence:** ${topPred.confidence || '95%'}\n`;
        reply += `- **Location:** ${topPred.location || 'North trail'}\n`;
        reply += `- **Time:** ${topPred.time || 'Recent'} (${topPred.date || 'Today'})\n`;
        reply += `- **Threat Assessment:** **HIGH ALERT** (Audio siren: ${ctx.alarmArmed ? 'ARMED' : 'MUTED'})\n\n`;
        reply += `**Recommended Field Action:**\n`;
        reply += `• Do not patrol the ${topPred.location} sector on foot.\n`;
        reply += `• Dispatch quad-bike / vehicle ranger team equipped with visual beacons.\n`;
        reply += `• Stand by with high-decibel acoustic alarm.\n`;

        return {
          text: reply,
          alertType: 'danger',
          actions: [
            { label: '🚨 Trigger Siren', command: 'sound alarm' },
            { label: '📍 View Field Map', command: 'show map' }
          ],
          chips: ['Tiger Safety SOP', 'Leopard Safety SOP', 'Sound Alarm', 'Radar Telemetry']
        };
      } else {
        return {
          text: `🛡️ **ALL CLEAR: NO APEX PREDATORS IN LIVE WINDOW**\n\n- Active perimeter: Zero dangerous predators registered in recent frames.\n- Total general wildlife detections logged: **${ctx.totalDetections} records**.\n- Siren status: **${ctx.alarmArmed ? 'Armed & Ready' : 'Muted'}**.\n- Acoustic radar: **${ctx.radarActive ? 'Active 180° sweep' : 'Standby'}**.`,
          alertType: 'success',
          chips: ['Recent Sightings', 'Radar Telemetry', 'Tiger Facts', 'Survival Water']
        };
      }
    }

    // 7. RECENT SIGHTINGS & DETECTIONS
    if (q.includes('detection') || q.includes('sighting') || q.includes('history') || q.includes('records') || q.includes('logged')) {
      const dets = ctx.recentDetections;
      if (dets.length === 0) {
        return {
          text: `📋 **DETECTION LOG EMPTY**\n\nNo wildlife sightings registered yet. Ensure camera stream is online or simulate a detection test in settings.`,
          alertType: 'info',
          chips: ['Radar Telemetry', 'Predator Status', 'Tiger Facts']
        };
      }
      let reply = `🐾 **LATEST WILDLIFE SIGHTINGS (${dets.length} most recent):**\n\n`;
      dets.forEach((d, idx) => {
        const icon = d.symbol || '🐾';
        reply += `${idx + 1}. **${d.animal}** (*${d.species}*) ${icon}\n`;
        reply += `   • **Confidence:** ${d.confidence || '94%'}\n`;
        reply += `   • **Location:** ${d.location || 'Node 04'}\n`;
        reply += `   • **Timestamp:** ${d.time || 'N/A'}\n\n`;
      });
      return {
        text: reply,
        alertType: 'info',
        actions: [
          { label: '📊 View Full Table', command: 'go to detections' }
        ],
        chips: ['Predator Status', 'Radar Telemetry', 'Tiger Facts', 'Elephant Speed']
      };
    }

    // 8. RADAR & ULTRASONIC TELEMETRY
    if (q.includes('radar') || q.includes('ultrasonic') || q.includes('distance') || q.includes('telemetry') || q.includes('sensor') || q.includes('obstacle')) {
      let reply = `📡 **RADAR & ULTRASONIC TELEMETRY BRIEFING**\n\n`;
      if (ctx.radarActive && ctx.radarDistanceCm !== null) {
        reply += `- **Sensor Status:** **ONLINE (LIVE)**\n`;
        reply += `- **Distance Reading:** **${ctx.radarDistanceCm.toFixed(1)} cm**\n`;
        reply += `- **Sweep Angle:** **${Math.round(ctx.radarAngle)}°**\n`;
        reply += `- **Obstacle Alarm:** ${ctx.radarObstacle ? '🚨 **OBSTACLE DETECTED IN PROXIMITY**' : '✅ Clear Range'}\n`;
        reply += `- **Source Interface:** ${ctx.radarSource}\n`;
      } else {
        reply += `- **Sensor Status:** **STANDBY / WAITING FOR BRIDGE**\n`;
        reply += `- **Interface:** USB Serial / Wi-Fi Radar Bridge\n`;
        reply += `- **Note:** Connect your Arduino / ESP32 HC-SR04 module or launch \`npm run radar\` to stream physical measurements.\n`;
      }
      return {
        text: reply,
        alertType: ctx.radarObstacle ? 'danger' : 'info',
        chips: ['Predator Status', 'Recent Sightings', 'Toggle Siren', 'Elephant Speed']
      };
    }

    // 9. NAVIGATION COMMANDS
    if (q.includes('map') || q.includes('field map')) {
      if (window.FieldWatch && typeof window.FieldWatch.scrollSection === 'function') {
        window.FieldWatch.scrollSection('map');
      }
      return {
        text: `🗺️ **NAVIGATING TO FIELD MAP**\n\nDisplaying photorealistic hybrid satellite tracking for Kolkata Station (Node 04) and surrounding sensor nodes.`,
        alertType: 'info',
        chips: ['Latest Sightings', 'Radar Telemetry', 'Sundarbans Delta']
      };
    }

    if (q.includes('go to detections') || q.includes('show detections')) {
      if (window.FieldWatch && typeof window.FieldWatch.scrollSection === 'function') {
        window.FieldWatch.scrollSection('detections');
      }
      return {
        text: `📋 **NAVIGATING TO DETECTIONS ARCHIVE**\n\nDisplaying verified wildlife records with species classifications, timestamps, and confidence levels.`,
        alertType: 'info',
        chips: ['Predator Status', 'Recent Sightings', 'Tiger Facts']
      };
    }

    if (q.includes('settings') || q.includes('team') || q.includes('config')) {
      if (window.FieldWatch && typeof window.FieldWatch.openSettingsModal === 'function') {
        window.FieldWatch.openSettingsModal();
      }
      return {
        text: `⚙️ **OPENING SYSTEM SETTINGS & RESEARCH TEAM CREDENTIALS**\n\nAccessing AI Perception Model settings, Hardware Telemetry baud controls, and SIH Engineering Team credentials.`,
        alertType: 'info',
        chips: ['Recent Sightings', 'Radar Telemetry']
      };
    }

    // 10. PROJECT & SIH INFORMATION
    if (q.includes('who are you') || q.includes('what are you') || q.includes('sih') || q.includes('fieldwatch') || q.includes('smart india hackathon') || q === 'about' || q.includes('about fieldwatch') || q.includes('about project') || q.includes('about this system') || q.includes('about you')) {
      return {
        text: `🌿 **FIELDWATCH OS // TACTICAL RANGER AI**\n\n` +
          `I am your tactical AI field copilot and wildlife encyclopedia, developed for **Smart India Hackathon (SIH)**.\n\n` +
          `- **Mission:** Autonomous wildlife early-warning & human-wildlife conflict mitigation system.\n` +
          `- **Key Technologies:** YOLOv8 edge vision, ESP32-CAM, HC-SR04 ultrasonic radar, Node.js/MongoDB persistence, and Liquid Glass tactical UI.\n` +
          `- **Station Node:** ${ctx.station}\n` +
          `- **Authorized Lead:** ${ctx.researcherName} (${ctx.researcherRole}).`,
        alertType: 'success',
        chips: ['Tiger Facts', 'Snakebite Protocol', 'Sundarbans Delta', 'Radar Telemetry']
      };
    }

    // 11. DYNAMIC QUESTION SYNTHESIZER (For Any General Wildlife/Jungle Questions)
    const isQuestion = q.includes('?') || 
      q.startsWith('who') || q.startsWith('what') || q.startsWith('why') || 
      q.startsWith('how') || q.startsWith('where') || q.startsWith('when') || 
      q.startsWith('which') || q.startsWith('can') || q.startsWith('is') || 
      q.startsWith('are') || q.startsWith('do') || q.startsWith('does') || 
      q.startsWith('tell me') || q.startsWith('explain');

    if (isQuestion || q.includes('jungle') || q.includes('forest') || q.includes('animal') || q.includes('wildlife')) {
      // Check for forest / jungle ecology
      if (q.includes('jungle') || q.includes('forest') || q.includes('rainforest') || q.includes('woods')) {
        return {
          text: `🌿 **JUNGLE & FOREST ECOLOGY BRIEFING**\n\n` +
            `Tropical jungles and dense forests are structured into four distinct vertical layers:\n\n` +
            `1. **Emergent Layer (40–60m):** Giant canopy trees that brave harsh sunlight and tropical storms (home to raptors, eagles, and bats).\n` +
            `2. **Canopy Layer (20–40m):** Dense ceiling of overlapping leaves and branches housing over 70% of jungle biodiversity (langurs, hornbills, tree frogs).\n` +
            `3. **Understory (5–20m):** Shaded realm of broad-leafed saplings, epiphytes, and climbing lianas (leopard ambush zones and arboreal vipers).\n` +
            `4. **Forest Floor:** Highly humid, dark leaf litter where decomposition fuels the ecosystem (prowling grounds of Bengal Tigers, Asian Elephants, and Sloth Bears).\n\n` +
            `*Ask me about specific reserves like Sundarbans, Kaziranga, Corbett, or Western Ghats!*`,
          alertType: 'info',
          chips: ['👑 King of Jungle', '🌊 Sundarbans Delta', '🦏 Kaziranga Grasslands', '💧 Water in Jungle']
        };
      }

      // Check for general animal / wildlife
      if (q.includes('animal') || q.includes('wildlife') || q.includes('creature') || q.includes('species') || q.includes('beast')) {
        return {
          text: `🐾 **ZOOLOGICAL FIELD INTELLIGENCE**\n\n` +
            `The Indian subcontinent is one of the world's 17 megadiverse nations, harboring over 500 mammal species, 1,300 bird species, and 450 reptile species.\n\n` +
            `• **Apex Hypercarnivores:** Bengal Tiger, Asiatic Lion, Indian Leopard, Snow Leopard.\n` +
            `• **Megaherbivores:** Asian Elephant, Greater One-Horned Rhinoceros, Indian Gaur.\n` +
            `• **Apex Reptiles:** King Cobra, Saltwater Crocodile, Russell's Viper.\n\n` +
            `*Ask about any specific animal, its running speed, diet, bite force, or safety protocol!*`,
          alertType: 'info',
          chips: ['👑 King of Jungle', '🐅 Bengal Tiger', '🐘 Asian Elephant', '⚡ Fastest Animals']
        };
      }

      // General question fallback with targeted context
      return {
        text: `🌲 **FIELD INTELLIGENCE REPORT**\n\n` +
          `Regarding your question: *"**${query}**"*\n\n` +
          `Here is what you can explore with Ranger AI's master zoological database:\n` +
          `• **Species Profiles:** *"Tell me about Bengal tigers / Asiatic lions / Rhinos / Sloth bears / King cobras"*\n` +
          `• **Biological Trivia:** *"Who is the king of the jungle?"*, *"Tiger vs Lion"*, *"Fastest animal"*, *"Why do tigers have stripes?"*\n` +
          `• **Jungle Bushcraft:** *"How to find drinking water"*, *"Snakebite first aid"*, *"Emergency shelter"*\n` +
          `• **Hardware Console:** *"Check predator status"*, *"Radar distance"*, *"Arm siren"*`,
        alertType: 'info',
        chips: ['👑 King of Jungle', '🥊 Tiger vs Lion', '⚡ Fastest Animals', '🐅 Tiger Facts', '🚨 Predator Status']
      };
    }

    // 12. DEFAULT FALLBACK
    return {
      text: `👋 **RANGER AI WILDLIFE & FIELD INTELLIGENCE**\n\n` +
        `I am your master wildlife and jungle tactical assistant. Ask me anything:\n\n` +
        `• **Animals:** *"Who is the king of the jungle?"*, *"Tiger vs Lion"*, *"Tell me about Bengal tigers / Rhinos / Sloth bears"*\n` +
        `• **Jungle Survival:** *"How to find drinking water in the wild?"*, *"Snakebite first aid"*, *"Jungle navigation"*\n` +
        `• **Forest Ecology:** *"Tell me about Sundarbans / Kaziranga / Corbett / Western Ghats"*\n` +
        `• **Wildlife Trivia:** *"What is the fastest animal?"*, *"Why do tigers have stripes?"*, *"Difference between horns and antlers"*\n` +
        `• **Console Controls:** *"Check predator status"*, *"Radar distance"*, *"Trigger siren"*`,
      alertType: 'info',
      chips: ['👑 King of Jungle', '🥊 Tiger vs Lion', '🐅 Tiger Facts', '💧 Water in Jungle', '🚨 Predator Status', '📡 Radar Telemetry']
    };
  }

  // Format message text with markdown-like tags to clean HTML
  function formatMessageText(text) {
    if (!text) return '';
    let formatted = escapeHtml(text);

    // Bold **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code `text`
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="fw-chat-code">$1</code>');
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  // Speech Recognition (STT Dictation)
  function setupSpeechRecognition(inputEl, micBtn) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      if (micBtn?.style) micBtn.style.display = 'none';
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        state.isListening = true;
        micBtn.classList.add('listening');
        inputEl.placeholder = 'Listening... Speak your wildlife or tactical question';
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          inputEl.value = transcript;
          submitMessage(transcript);
        }
      };

      recognition.onerror = () => {
        state.isListening = false;
        micBtn.classList.remove('listening');
        inputEl.placeholder = 'Ask Ranger AI any jungle, animal, or tactical question...';
      };

      recognition.onend = () => {
        state.isListening = false;
        micBtn.classList.remove('listening');
        inputEl.placeholder = 'Ask Ranger AI any jungle, animal, or tactical question...';
      };

      state.recognition = recognition;
    } catch {}
  }

  // Append a message to the chat view
  function appendMessage({ role, text, alertType = 'info', chips = [], actions = [], source = 'tactical-engine' }) {
    const messagesContainer = document.querySelector('#fw-chatbot-messages');
    if (!messagesContainer) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const msgDiv = document.createElement('div');
    msgDiv.className = `fw-chat-msg fw-chat-msg-${role} ${alertType ? `fw-alert-${alertType}` : ''}`;
    msgDiv.id = msgId;

    if (role === 'assistant') {
      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'fw-msg-avatar';
      const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgIcon.setAttribute('width', '14');
      svgIcon.setAttribute('height', '14');
      svgIcon.setAttribute('viewBox', '0 0 24 24');
      svgIcon.setAttribute('fill', 'none');
      svgIcon.setAttribute('stroke', 'currentColor');
      svgIcon.setAttribute('stroke-width', '2');
      svgIcon.setAttribute('stroke-linecap', 'round');
      svgIcon.setAttribute('stroke-linejoin', 'round');

      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path1.setAttribute('d', 'M12 8V4H8');
      const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect1.setAttribute('width', '16');
      rect1.setAttribute('height', '12');
      rect1.setAttribute('x', '4');
      rect1.setAttribute('y', '8');
      rect1.setAttribute('rx', '2');
      const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path2.setAttribute('d', 'M2 14h2');
      const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path3.setAttribute('d', 'M20 14h2');
      const path4 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path4.setAttribute('d', 'M15 13v2');
      const path5 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path5.setAttribute('d', 'M9 13v2');

      svgIcon.appendChild(path1);
      svgIcon.appendChild(rect1);
      svgIcon.appendChild(path2);
      svgIcon.appendChild(path3);
      svgIcon.appendChild(path4);
      svgIcon.appendChild(path5);
      avatarDiv.appendChild(svgIcon);
      msgDiv.appendChild(avatarDiv);

      const bubbleDiv = document.createElement('div');
      bubbleDiv.className = 'fw-msg-bubble';

      const headerDiv = document.createElement('div');
      headerDiv.className = 'fw-msg-header';

      const senderSpan = document.createElement('span');
      senderSpan.className = 'fw-msg-sender';
      senderSpan.textContent = 'RANGER AI ';

      const pillSpan = document.createElement('span');
      pillSpan.className = 'fw-source-pill';
      pillSpan.textContent = source === 'gemini-1.5-flash' ? 'GEMINI CLOUD AI' : 'WILDLIFE ENGINE';
      senderSpan.appendChild(pillSpan);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'fw-msg-time';
      timeSpan.textContent = timeStr;

      headerDiv.appendChild(senderSpan);
      headerDiv.appendChild(timeSpan);
      bubbleDiv.appendChild(headerDiv);

      const textDiv = document.createElement('div');
      textDiv.className = 'fw-msg-text';
      textDiv.innerHTML = formatMessageText(text);
      bubbleDiv.appendChild(textDiv);

      if (Array.isArray(actions) && actions.length > 0) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'fw-chat-actions';
        actions.forEach(act => {
          if (!act) return;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'fw-action-btn';
          btn.textContent = act.label || '';
          btn.addEventListener('click', () => {
            if (act.command) {
              submitMessage(act.command);
            }
          });
          actionsDiv.appendChild(btn);
        });
        bubbleDiv.appendChild(actionsDiv);
      }

      msgDiv.appendChild(bubbleDiv);
    } else {
      const bubbleDiv = document.createElement('div');
      bubbleDiv.className = 'fw-msg-bubble';

      const textDiv = document.createElement('div');
      textDiv.className = 'fw-msg-text';
      textDiv.innerHTML = formatMessageText(text);
      bubbleDiv.appendChild(textDiv);

      const footerDiv = document.createElement('div');
      footerDiv.className = 'fw-msg-footer';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'fw-msg-time';
      timeSpan.textContent = timeStr;
      footerDiv.appendChild(timeSpan);
      bubbleDiv.appendChild(footerDiv);

      msgDiv.appendChild(bubbleDiv);
    }

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update Quick Action Chips row if assistant provided new suggestions
    if (role === 'assistant' && Array.isArray(chips) && chips.length > 0) {
      renderChips(chips);
    }

    // Unread counter if window is minimized or closed
    if (!state.isOpen && role === 'assistant') {
      state.unreadCount++;
      updateUnreadBadge();
    }
  }

  // Render Prompt Chips
  function renderChips(chipsList) {
    const chipsContainer = document.querySelector('#fw-chatbot-chips');
    if (!chipsContainer || !Array.isArray(chipsList)) return;

    chipsContainer.innerHTML = '';
    chipsList.forEach(chipText => {
      const chipBtn = document.createElement('button');
      chipBtn.type = 'button';
      chipBtn.className = 'fw-chip';
      chipBtn.textContent = chipText;
      chipBtn.addEventListener('click', () => {
        submitMessage(chipText);
      });
      chipsContainer.appendChild(chipBtn);
    });
  }

  // Show Typing Indicator
  function showTypingIndicator() {
    const messagesContainer = document.querySelector('#fw-chatbot-messages');
    if (!messagesContainer) return null;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'fw-chat-msg fw-chat-msg-assistant fw-typing-indicator';
    typingDiv.id = 'fw-chat-typing';
    typingDiv.innerHTML = `
      <div class="fw-msg-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 8V4H8"></path>
          <rect width="16" height="12" x="4" y="8" rx="2"></rect>
        </svg>
      </div>
      <div class="fw-msg-bubble fw-typing-bubble">
        <div class="fw-typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return typingDiv;
  }

  function removeTypingIndicator() {
    const typing = document.querySelector('#fw-chat-typing');
    if (typing) typing.remove();
  }

  // Submit User Message
  async function submitMessage(rawText) {
    const text = (rawText || '').trim();
    if (!text) return;

    const input = document.querySelector('#fw-chatbot-input');
    if (input) input.value = '';

    // Append User Message
    appendMessage({ role: 'user', text });
    state.history.push({ role: 'user', text });

    const typing = showTypingIndicator();

    // 1. First check local offline encyclopedia for instantaneous high-precision response
    const localMatch = searchWildlifeIntelligence(text);

    // 2. If it's a console command (siren, radar, camera, etc.) or specific offline match
    if (localMatch) {
      setTimeout(() => {
        removeTypingIndicator();
        appendMessage({
          role: 'assistant',
          text: localMatch.text,
          alertType: localMatch.alertType || 'info',
          chips: localMatch.chips || [],
          actions: localMatch.actions || [],
          source: 'local-wildlife-engine'
        });
        state.history.push({ role: 'assistant', text: localMatch.text });
      }, 250);
      return;
    }

    // 3. For open-ended inquiries, attempt backend Gemini API if available
    let answered = false;
    try {
      const ctx = getLiveSystemContext();
      let token = null;
      try {
        const sessionRaw = localStorage.getItem('fieldwatch_auth_session');
        token = JSON.parse(sessionRaw)?.token;
      } catch {}

      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          history: state.history.slice(-6),
          context: ctx
        }),
        signal: AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.reply) {
          removeTypingIndicator();
          answered = true;
          const botReply = {
            role: 'assistant',
            text: data.reply,
            source: data.source || 'gemini-1.5-flash',
            alertType: data.reply.includes('CRITICAL') || data.reply.includes('HIGH') ? 'danger' : 'info',
            chips: ['Tiger Facts', 'Snakebite Protocol', 'Sundarbans Delta', 'Radar Telemetry']
          };
          appendMessage(botReply);
          state.history.push({ role: 'assistant', text: data.reply });
          return;
        }
      }
    } catch {}

    // 4. Fallback to general tactical response
    if (!answered) {
      setTimeout(() => {
        removeTypingIndicator();
        const tacticalResult = generateLocalTacticalReply(text);
        appendMessage({
          role: 'assistant',
          text: tacticalResult.text,
          alertType: tacticalResult.alertType || 'info',
          chips: tacticalResult.chips || [],
          actions: tacticalResult.actions || [],
          source: 'local-tactical-engine'
        });
        state.history.push({ role: 'assistant', text: tacticalResult.text });
      }, 300);
    }
  }

  // Update unread badge on floating launcher
  function updateUnreadBadge() {
    const badge = document.querySelector('#fw-chatbot-unread-badge');
    if (!badge) return;
    if (state.unreadCount > 0) {
      badge.textContent = state.unreadCount > 9 ? '9+' : String(state.unreadCount);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // Open & Close Window
  function openChatbot() {
    const win = document.querySelector('#fw-chatbot-window');
    const launcher = document.querySelector('#fw-chatbot-launcher');
    if (!win) return;

    win.classList.remove('hidden');
    win.classList.add('visible');
    state.isOpen = true;
    state.unreadCount = 0;
    updateUnreadBadge();

    if (launcher) {
      launcher.classList.add('active');
    }

    // Focus input
    const input = document.querySelector('#fw-chatbot-input');
    if (input) {
      setTimeout(() => input.focus(), 150);
    }
  }

  function closeChatbot() {
    const win = document.querySelector('#fw-chatbot-window');
    const launcher = document.querySelector('#fw-chatbot-launcher');
    if (!win) return;

    win.classList.remove('visible');
    win.classList.add('hidden');
    state.isOpen = false;

    if (launcher) {
      launcher.classList.remove('active');
    }

    if (state.recognition && state.isListening) {
      try { state.recognition.stop(); } catch {}
    }
  }

  function toggleChatbot() {
    if (state.isOpen) {
      closeChatbot();
    } else {
      openChatbot();
    }
  }

  // Reset / Clear chat
  function clearChat() {
    const messagesContainer = document.querySelector('#fw-chatbot-messages');
    if (!messagesContainer) return;
    messagesContainer.innerHTML = '';
    state.history = [];
    showWelcomeBriefing();
  }

  // Initial Welcome Briefing Card
  function showWelcomeBriefing() {
    const ctx = getLiveSystemContext();
    const welcomeText = `🛰️ **FIELDWATCH RANGER AI ONLINE**\n\n` +
      `Tactical operations assistant connected to **${ctx.station}**.\n\n` +
      `- **Station Officer:** ${ctx.researcherName}\n` +
      `- **Live Detections Logged:** ${ctx.totalDetections} records\n` +
      `- **Acoustic Radar:** ${ctx.radarActive ? 'Active 180° Sweep' : 'Standby Mode'}\n` +
      `- **Predator Defense Siren:** ${ctx.alarmArmed ? 'ARMED' : 'MUTED'}\n\n` +
      `Ask me any question about wild animals, jungle survival, Indian national parks, tracking, or standing field safety protocols!`;

    appendMessage({
      role: 'assistant',
      text: welcomeText,
      alertType: 'info',
      chips: [
        '🐅 Tiger Facts',
        '💧 Water in Jungle',
        '🐍 Big Four Snakes',
        '🌊 Sundarbans Delta',
        '🚨 Predator Status',
        '📡 Radar Telemetry'
      ],
      source: 'wildlife-engine'
    });
  }

  // Mount UI Elements & Listeners
  function initDOM() {
    const launcher = document.querySelector('#fw-chatbot-launcher');
    const closeBtn = document.querySelector('#fw-chatbot-close-btn');
    const minBtn = document.querySelector('#fw-chatbot-minimize-btn');
    const clearBtn = document.querySelector('#fw-chatbot-clear-btn');
    const form = document.querySelector('#fw-chatbot-form');
    const input = document.querySelector('#fw-chatbot-input');
    const micBtn = document.querySelector('#fw-chatbot-mic-btn');
    const navItem = document.querySelector('#nav-ai-copilot');

    if (launcher) {
      launcher.addEventListener('click', toggleChatbot);
    }

    if (navItem) {
      navItem.addEventListener('click', (e) => {
        e.preventDefault();
        openChatbot();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeChatbot);
    }

    if (minBtn) {
      minBtn.addEventListener('click', () => {
        const win = document.querySelector('#fw-chatbot-window');
        if (win) {
          win.classList.toggle('minimized');
          state.isMinimized = win.classList.contains('minimized');
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', clearChat);
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input && input.value.trim()) {
          submitMessage(input.value);
        }
      });
    }

    // Voice dictation mic
    if (input && micBtn) {
      setupSpeechRecognition(input, micBtn);
      micBtn.addEventListener('click', () => {
        if (!state.recognition) return;
        if (state.isListening) {
          state.recognition.stop();
        } else {
          try { state.recognition.start(); } catch {}
        }
      });
    }

    // Keyboard Shortcuts: Ctrl + / to open/close, Escape to close
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleChatbot();
      } else if (e.key === 'Escape' && state.isOpen) {
        closeChatbot();
      }
    });

    // Populate initial briefing
    showWelcomeBriefing();
  }

  // Public API
  window.RangerAI = {
    open: openChatbot,
    close: closeChatbot,
    toggle: toggleChatbot,
    ask: submitMessage,
    clear: clearChat
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDOM);
  } else {
    initDOM();
  }
})();
