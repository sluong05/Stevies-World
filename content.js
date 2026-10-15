import { researchedEstimates } from './data/recipe-estimates.js';

// General adult health information.
// Source links were checked on October 13, 2026.
const cookingSource = {
  label: 'FoodSafety.gov · Safe cooking temperatures',
  url: 'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures',
};
const handlingSource = {
  label: 'FoodSafety.gov · Clean, separate, cook, chill',
  url: 'https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety',
};

// Only the recipes supplied by Stevie are included; the previous starter catalog stays removed.
const curryEstimates = researchedEstimates('japanese-curry-for-katsu');
const udonEstimates = researchedEstimates('beef-udon-niku-udon');
export const recipes = [
  {
    id: 'japanese-curry-for-katsu',
    title: 'Japanese Curry (for Katsu)',
    description: 'Your potato, onion, and carrot curry sauce, made with S&B curry cubes. Ready to spoon over katsu or serve however you like.',
    category: 'Dinner', minutes: 35, servings: 4,
    tags: ['Your cookbook', 'Japanese', 'Curry sauce'],
    photo: {
      src: '/assets/japanese-curry.jpg', alt: 'Serving inspiration: Japanese vegetable curry with rice on a white plate',
      author: 'pelican', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Vegetable_curry_rice_(14974664885).jpg',
      license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      caption: 'Serving inspiration: “Vegetable curry rice” by pelican. Photo displayed cropped to fit. Rice is shown, but is not included in the sauce estimates.',
    },
    ingredients: [
      '1 whole small box S&B Golden Curry cubes (92 g; mild used for the estimates)',
      '2 medium potatoes (about 340 g total), cut into bite-size pieces',
      '1 medium onion (about 150 g), sliced or diced',
      '1 medium carrot (about 61 g), sliced',
      '3 cups water (about 710 ml)',
      '1 tablespoon cooking oil (about 13.5 g; standard amount assumed)',
      'Salt and sugar, to taste (optional; not included in the estimates)',
    ],
    steps: [
      'Cut the onion, carrot, and potatoes into evenly sized pieces.',
      'Heat the oil in a pot. Add the onion first, followed by the carrot and potatoes.',
      'Cook over high heat for about 5 minutes, stirring to keep the vegetables from catching.',
      'Add the 3 cups water. Reduce to medium heat, cover, and simmer for about 15 minutes, until the vegetables are tender. Add salt or sugar to taste if you want them.',
      'Turn off the heat. Break up and add all the curry cubes, then stir until dissolved.',
      'Return to a gentle simmer, stirring, until the sauce is smooth and thickened, about 5 minutes. Add a little extra water if needed. Serve with separately prepared katsu or your preferred sides.',
    ],
    note: 'Transcribed from your handwritten cookbook. Standard assumptions: one small 92 g box, 4 sauce servings, and about 35 minutes total. The original specifies a whole packet but not its size; a larger box changes both the water needed and the estimates. This recipe covers the vegetable curry sauce only: no katsu, rice, or extra sugar is counted. Contains wheat; check your curry packet for other allergens.',
    nutrition: { ...curryEstimates.nutrition, note: 'Estimated per sauce serving, assuming 4 servings from one 92 g S&B Mild box, 340 g potato, 150 g onion, 61 g carrot and 1 tablespoon oil. Rice, katsu, extra sugar and extra salt are excluded. Packet flavor, size and vegetable weights change these values. Sources reviewed October 15, 2026.' },
    cost: { ...curryEstimates.cost, note: 'Estimated cost of the ingredient amounts used for the full 4-serving sauce recipe. Representative US online prices checked October 15, 2026, plus a $0.10 cooking-oil allowance. Rice, katsu, optional seasoning, delivery, tax and unused portions of full packages are excluded. Store and location prices vary.' },
    sources: [{ label: 'Recipe source: your handwritten cookbook; amounts standardized with your approval', url: 'https://github.com/sluong05/Stevies-World/blob/main/RECIPE-ESTIMATES.md' }],
  },
  {
    id: 'beef-udon-niku-udon',
    title: 'Beef Udon (Niku Udon)',
    description: 'Your thinly sliced beef and onion udon, with a sweet-savory topping and a simple Hondashi broth. Finish with green onions and an optional soft-boiled egg.',
    category: 'Dinner', minutes: 30, servings: 2,
    tags: ['Your cookbook', 'Japanese', 'Noodle soup'],
    photo: {
      src: '/assets/beef-udon.png', alt: 'Beef udon in a white bowl with green onions and optional soft-boiled egg halves',
      author: 'Your cookbook', caption: 'AI-assisted adaptation of the food photo in your cookbook screenshot. The optional egg and green onion topping shown are excluded from the base estimates.',
    },
    ingredients: [
      'Beef topping: 200 g thinly sliced beef (shabu-shabu style; standard amount assumed)',
      'Beef topping: ½ large onion (about 100 g), thinly sliced',
      'Beef topping: 1 teaspoon cooking oil (about 5 g; standard amount assumed)',
      'Beef sauce: 2 tablespoons soy sauce',
      'Beef sauce: 1 tablespoon sugar (about 12.5 g)',
      'Beef sauce: 1½ tablespoons mirin',
      'Beef sauce: ½ teaspoon grated ginger (about 1 g)',
      'Broth: 4 cups water (about 950 ml)',
      'Broth: 2 tablespoons soy sauce',
      'Broth: 2 tablespoons mirin',
      'Broth: 1½ teaspoons Hondashi granules (about 4.5 g)',
      'Noodles: 2 packs ready-to-use udon (200 g each; standard amount assumed)',
      'Optional: 1 large egg per bowl, soft-boiled for 6–7 minutes',
      'Optional: sliced green onions, to finish',
    ],
    steps: [
      'Mix the beef sauce: 2 tablespoons soy sauce, 1 tablespoon sugar, 1½ tablespoons mirin, and the grated ginger.',
      'Heat the oil in a pan. Fry the thinly sliced beef and onion until browned. Add the beef sauce and cook for about 3 minutes, until the beef is cooked through and the onion is tender.',
      'In a saucepan, combine all the broth ingredients. Bring to a boil, then turn off the heat and taste.',
      'If adding eggs, gently lower them into boiling water, cook for about 6–7 minutes, then transfer to ice water and peel. For a fully cooked yolk, cook longer. You can reuse the pot with fresh water for the noodles.',
      'Cook the udon in boiling water according to its package, then drain. Your handwritten method uses about 5 minutes; ready-to-use, frozen, and dried noodles have different timings.',
      'Warm the serving bowls with hot noodle water, then empty them. Divide the noodles between 2 bowls, pour over the broth, and add the beef and onion topping. Finish with green onions and the optional halved eggs.',
    ],
    note: 'Transcribed from your handwritten cookbook, which lists approximately 1–2 people. Estimates use 2 bowls, 200 g raw shaved beef, 400 g ready-to-use udon, 100 g onion, and 1 teaspoon oil. All broth and beef sauce are counted; eggs and green onion garnish are optional and excluded. One large egg adds about 72 kcal, 6.3 g protein, 0.4 g carbs, 4.8 g fat, and $0.14 per bowl at the referenced $1.67/dozen price. Contains wheat, soy, and fish (Hondashi); egg is optional and some Hondashi versions contain milk. About 30 minutes total is an estimate.',
    nutrition: { ...udonEstimates.nutrition, note: 'Estimated per bowl, assuming 2 bowls with 200 g beef and 400 g ready-to-use udon in total. Includes all broth and sauce, with no subtraction for mirin alcohol evaporation. Optional egg and green onion garnish are excluded. Sodium is roughly 2,700 mg per bowl if all broth is consumed; brands and how much broth you drink change that amount. Sources reviewed October 15, 2026.' },
    cost: { ...udonEstimates.cost, note: 'Estimated cost of ingredients used for both bowls. Representative US online prices checked October 15, 2026; the Hondashi price is an online jar benchmark that may be out of stock. Soy sauce, oil, sugar and ginger use small stated pantry allowances. Optional eggs/garnish, tax, delivery and unused package contents are excluded. Prices vary by store and location.' },
    sources: [
      { label: 'Recipe source and full estimate calculations', url: 'https://github.com/sluong05/Stevies-World/blob/main/RECIPE-ESTIMATES.md' },
      { label: 'USDA · Optional large egg nutrition', url: 'https://fdc.nal.usda.gov/food-details/171287/nutrients' },
      { label: 'Walmart · Optional eggs, 12 count price reference', url: 'https://www.walmart.com/c/kp/eggs-12-count-great-value' },
    ],
  },
];

export const articles = [
  {
    id: 'balanced-meals',
    title: 'A little more balance on your plate',
    description: 'An easy way to think about variety, satisfaction, and everyday meals.',
    category: 'Nutrition',
    readMinutes: 2,
    color: 'sage',
    icon: 'leaf',
    sections: [
      {
        heading: 'Start with a flexible picture',
        body: 'Canada’s food guide offers a useful visual: vegetables and fruit fill roughly half the plate, whole grains one quarter, and protein foods the remaining quarter. Think of this as a way to bring variety to meals. The illustration does not prescribe how much food you personally need.',
      },
      {
        heading: 'Use foods you already enjoy',
        body: 'Whole grains can mean oats, brown rice, or whole-grain bread. Protein can come from beans, lentils, tofu, eggs, fish, yogurt, or other foods; the guide encourages plant proteins more often. Fresh produce is only one option. Frozen, canned, and dried foods can also fit into a varied eating pattern.',
      },
      {
        heading: 'Bowls and soups count, too',
        body: 'The same idea works when ingredients are mixed together. A bowl of rice, chickpeas, and roasted vegetables can bring these elements together without arranging a perfect plate. Compare labels when useful, especially for sodium, sugars, and saturated fat. What you eat regularly matters more than making every meal look identical.',
      },
    ],
    sources: [{
      label: 'Health Canada · Make healthy meals with the food guide plate',
      url: 'https://www.canada.ca/en/health-canada/services/food-guide/eating-support/cooking/make-healthy-meals-plate.html',
    }],
    reviewedOn: '2026-10-13',
  },
  {
    id: 'sleep-basics',
    title: 'Give good sleep a little space',
    description: 'Why rest matters, what adults generally need, and what can make nights easier.',
    category: 'Sleep',
    readMinutes: 2,
    color: 'lavender',
    icon: 'moon',
    sections: [
      {
        heading: 'Duration and quality work together',
        body: 'CDC recommends at least 7 hours of sleep for adults ages 18–60, 7–9 hours for ages 61–64, and 7–8 hours for ages 65 and older. Enough time in bed is only part of the picture: healthy sleep also feels refreshing and is reasonably uninterrupted.',
      },
      {
        heading: 'Make the evening easier',
        body: 'Consistent bedtimes and wake times can support sleep. A cool, quiet bedroom and a calmer stretch before bed may help. CDC suggests switching off electronic devices at least 30 minutes before bedtime, avoiding afternoon or evening caffeine, and avoiding large meals and alcohol close to bed. Regular physical activity can help support sleep, too.',
      },
      {
        heading: 'Notice how you feel',
        body: 'Sleep supports attention, memory, mood, and physical health. Repeated waking, trouble falling asleep, or feeling tired despite enough sleep are reasons to look beyond the clock. If sleep problems happen regularly, discuss them with a healthcare professional. Some sleep disorders need assessment and treatment; a better bedtime routine alone may not resolve them.',
      },
    ],
    sources: [{label: 'CDC · About sleep', url: 'https://www.cdc.gov/sleep/about/index.html'}],
    reviewedOn: '2026-10-13',
  },
  {
    id: 'everyday-movement',
    title: 'Movement that fits real life',
    description: 'Walking, dancing, lifting: understanding the basics without making it a competition.',
    category: 'Movement',
    readMinutes: 2,
    color: 'peach',
    icon: 'sun',
    sections: [
      {
        heading: 'There is more than one way to move',
        body: 'For adults, CDC describes a weekly foundation of at least 150 minutes of moderate aerobic activity, or 75 minutes of vigorous activity, plus muscle-strengthening activity on at least 2 days. An equivalent mixture of moderate and vigorous activity also counts. These are general population guidelines, not a personalized exercise prescription.',
      },
      {
        heading: 'Understand the intensity',
        body: 'Brisk walking and dancing can be moderate activities. At moderate intensity, you can usually talk but would struggle to sing; vigorous activity makes it hard to speak more than a few words without pausing for breath. The same activity can feel different to different people, so effort matters alongside the activity’s name.',
      },
      {
        heading: 'Small amounts have a place',
        body: 'Activity can be spread across the week in shorter sessions. Some movement is better than none, and sitting less can help. Strength activities should involve the major muscle groups, including the legs, hips, back, abdomen, chest, shoulders, and arms. Explore forms of movement that feel enjoyable and fit your abilities; the guidelines are a reference, not a score.',
      },
    ],
    sources: [
      {label: 'CDC · Adult activity overview', url: 'https://www.cdc.gov/physical-activity-basics/guidelines/adults.html'},
      {label: 'CDC · Understanding activity intensity', url: 'https://www.cdc.gov/physical-activity-basics/measuring/index.html'},
    ],
    reviewedOn: '2026-10-13',
  },
  {
    id: 'hydration-basics',
    title: 'Hydration, without the hype',
    description: 'What water does for your body and why one fixed target does not fit everyone.',
    category: 'Hydration',
    readMinutes: 2,
    color: 'blue',
    icon: 'droplet',
    sections: [
      {
        heading: 'Water does everyday work',
        body: 'Water helps regulate body temperature, cushion joints, and remove waste. Getting enough fluid helps prevent dehydration. Your needs change with activity, climate, age, pregnancy or breastfeeding, and illness. Hot weather, physical activity, fever, vomiting, or diarrhea can increase fluid needs.',
      },
      {
        heading: 'Drinks are part of the picture',
        body: 'Fluid comes from water, other drinks, and foods. Fruit and vegetables with a high water content contribute, too. Plain water is a simple everyday choice. Unsweetened tea, sparkling water, and other low-calorie drinks can add variety, while milk or fortified alternatives can also provide nutrients.',
      },
      {
        heading: 'Keep it easy to reach',
        body: 'A glass with meals, a refillable bottle nearby, or a slice of lemon can make water more appealing. Replacing a sugary drink with water reduces added calories from that drink. There is no single number of glasses that suits every adult in every situation. This guide explains general principles rather than setting an individual fluid goal.',
      },
    ],
    sources: [{
      label: 'CDC · Water and healthier drinks',
      url: 'https://www.cdc.gov/healthy-weight-growth/water-healthy-drinks/',
    }],
    reviewedOn: '2026-10-13',
  },
  {
    id: 'kitchen-confidence',
    title: 'A little kitchen confidence',
    description: 'The essentials of safe preparation, cooking temperatures, and storing leftovers.',
    category: 'Food safety',
    readMinutes: 2,
    color: 'butter',
    icon: 'sparkles',
    sections: [
      {
        heading: 'Keep preparation clean',
        body: 'Wash hands with soap and water for at least 20 seconds. Rinse produce under running water, without soap. Raw meat, poultry, seafood, and eggs should stay separate from ready-to-eat food; wash equipment after contact. Do not rinse raw meat or poultry, because splashes can spread germs.',
      },
      {
        heading: 'Temperature beats guesswork',
        body: 'A food thermometer makes cooking safer. Fish should reach 145°F (63°C), poultry 165°F (74°C), and egg dishes 160°F (71°C). Reheated leftovers should reach 165°F (74°C). Measure the thickest part and use the linked temperature chart for other foods, including any required resting time.',
      },
      {
        heading: 'Cool and store promptly',
        body: 'Keep the refrigerator at 40°F (4°C) or colder. Refrigerate perishable foods within 2 hours, or within 1 hour when the surrounding temperature exceeds 90°F (32°C). Divide leftovers into shallow containers to cool promptly. Thaw frozen food in the refrigerator rather than leaving it on the counter.',
      },
    ],
    sources: [handlingSource, cookingSource],
    reviewedOn: '2026-10-13',
  },
];
