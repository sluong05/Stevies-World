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

// Start with an empty recipe collection. Personal recipes are saved in the browser.
export const recipes = [];

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
