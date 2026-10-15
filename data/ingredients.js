// USDA SR Legacy ingredient values per 100 g; researched budget assumptions in USD.
// Reviewed October 14, 2026. See BUDGET-MEALS.md.
export const ingredients = {
  "chicken": {
    "name": "raw boneless skinless chicken breast",
    "fdcId": "171077",
    "usdaDescription": "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw",
    "per100g": {
      "calories": 120.0,
      "protein": 22.5,
      "carbs": 0.0,
      "fat": 2.62
    },
    "pricePer100g": 0.882,
    "priceBasis": "Budget allowance $4/lb; frozen chicken reference $3.28/lb",
    "priceSource": "https://www.walmart.com/browse/food/chicken-breasts/great-value/976759_9569500_1001443_8161643/YnJhbmQ6R3JlYXQgVmFsdWUie"
  },
  "turkey": {
    "name": "raw 93% lean ground turkey",
    "fdcId": "172850",
    "usdaDescription": "Turkey, ground, 93% lean, 7% fat, raw",
    "per100g": {
      "calories": 150.0,
      "protein": 18.73,
      "carbs": 0.0,
      "fat": 8.34
    },
    "pricePer100g": 1.226,
    "priceBasis": "Representative 1 lb tray $5.56",
    "priceSource": "https://www.walmart.com/c/kp/butterball-ground-turkey"
  },
  "beef": {
    "name": "raw 90% lean ground beef",
    "fdcId": "174030",
    "usdaDescription": "Beef, ground, 90% lean meat / 10% fat, raw",
    "per100g": {
      "calories": 176.0,
      "protein": 20.0,
      "carbs": 0.0,
      "fat": 10.0
    },
    "pricePer100g": 1.543,
    "priceBasis": "Budget assumption $7/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "tuna": {
    "name": "canned light tuna in water, drained",
    "fdcId": "173709",
    "usdaDescription": "Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)",
    "per100g": {
      "calories": 86.0,
      "protein": 19.44,
      "carbs": 0.0,
      "fat": 0.96
    },
    "pricePer100g": 1.062,
    "priceBasis": "Budget allowance $1.20 per can yielding 113g drained; example can $0.96",
    "priceSource": "https://www.walmart.com/ip/11965048"
  },
  "salmon": {
    "name": "canned pink salmon, drained, skin and bones removed",
    "fdcId": "173724",
    "usdaDescription": "Fish, Salmon, pink, canned, drained solids, without skin and bones",
    "per100g": {
      "calories": 136.0,
      "protein": 24.62,
      "carbs": 0.0,
      "fat": 4.21
    },
    "pricePer100g": 1.5,
    "priceBasis": "Budget assumption $3 per 200g drained",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "tofu": {
    "name": "firm tofu, drained",
    "fdcId": "175236",
    "usdaDescription": "Vitasoy USA Azumaya, Firm Tofu",
    "per100g": {
      "calories": 80.0,
      "protein": 9.08,
      "carbs": 1.52,
      "fat": 4.2
    },
    "pricePer100g": 0.736,
    "priceBasis": "Representative extra-firm tofu $2.92 per 14 oz",
    "priceSource": "https://www.walmart.com/c/kp/firm-tofu"
  },
  "edamame": {
    "name": "shelled edamame, cooked",
    "fdcId": "169283",
    "usdaDescription": "Soybeans, green, cooked, boiled, drained, without salt",
    "per100g": {
      "calories": 141.0,
      "protein": 12.35,
      "carbs": 11.05,
      "fat": 6.4
    },
    "pricePer100g": 0.8,
    "priceBasis": "Budget assumption $2.72 per 340g shelled bag",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "lentils": {
    "name": "cooked lentils, drained",
    "fdcId": "172421",
    "usdaDescription": "Lentils, mature seeds, cooked, boiled, without salt",
    "per100g": {
      "calories": 116.0,
      "protein": 9.02,
      "carbs": 20.13,
      "fat": 0.38
    },
    "pricePer100g": 0.2,
    "priceBasis": "Budget assumption dried lentils $2.25/lb, 2.5x cooked yield",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "blackBeans": {
    "name": "canned black beans, drained and rinsed",
    "fdcId": "173735",
    "usdaDescription": "Beans, black, mature seeds, cooked, boiled, without salt",
    "per100g": {
      "calories": 132.0,
      "protein": 8.86,
      "carbs": 23.71,
      "fat": 0.54
    },
    "pricePer100g": 0.392,
    "priceBasis": "Budget allowance $1 per 255g drained; example 15 oz can $0.86",
    "priceSource": "https://www.walmart.com/browse/food/beans/976759_976794_4879140_6822160"
  },
  "kidneyBeans": {
    "name": "canned kidney beans, drained and rinsed",
    "fdcId": "175194",
    "usdaDescription": "Beans, kidney, red, mature seeds, cooked, boiled, without salt",
    "per100g": {
      "calories": 127.0,
      "protein": 8.67,
      "carbs": 22.8,
      "fat": 0.5
    },
    "pricePer100g": 0.392,
    "priceBasis": "Budget assumption $1 per 255g drained",
    "priceSource": "https://www.walmart.com/browse/food/beans/976759_976794_4879140_6822160"
  },
  "whiteBeans": {
    "name": "canned white beans, drained and rinsed",
    "fdcId": "175203",
    "usdaDescription": "Beans, white, mature seeds, cooked, boiled, without salt",
    "per100g": {
      "calories": 139.0,
      "protein": 9.73,
      "carbs": 25.09,
      "fat": 0.35
    },
    "pricePer100g": 0.431,
    "priceBasis": "Budget assumption $1.10 per 255g drained",
    "priceSource": "https://www.walmart.com/browse/food/beans/976759_976794_4879140_6822160"
  },
  "chickpeas": {
    "name": "canned chickpeas, drained and rinsed",
    "fdcId": "173801",
    "usdaDescription": "Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained, rinsed in tap water",
    "per100g": {
      "calories": 138.0,
      "protein": 7.04,
      "carbs": 22.87,
      "fat": 2.47
    },
    "pricePer100g": 0.48,
    "priceBasis": "Budget assumption $1.22 per 254g drained",
    "priceSource": "https://www.walmart.com/browse/food/beans/976759_976794_4879140_6822160"
  },
  "yogurt": {
    "name": "plain nonfat Greek yogurt",
    "fdcId": "170894",
    "usdaDescription": "Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)",
    "per100g": {
      "calories": 59.0,
      "protein": 10.19,
      "carbs": 3.6,
      "fat": 0.39
    },
    "pricePer100g": 0.362,
    "priceBasis": "Representative 32 oz tub $3.28",
    "priceSource": "https://www.walmart.com/c/best-sellers/great-value-plain-greek-yogurt"
  },
  "cottage": {
    "name": "2% cottage cheese",
    "fdcId": "172182",
    "usdaDescription": "Cheese, cottage, lowfat, 2% milkfat",
    "per100g": {
      "calories": 81.0,
      "protein": 10.45,
      "carbs": 4.76,
      "fat": 2.27
    },
    "pricePer100g": 0.478,
    "priceBasis": "Budget assumption 24 oz tub $3.25; representative fat-free tub $2.87",
    "priceSource": "https://www.walmart.com/c/kp/cottage-cheese-great-value"
  },
  "eggs": {
    "name": "large eggs, without shells",
    "fdcId": "171287",
    "usdaDescription": "Egg, whole, raw, fresh",
    "per100g": {
      "calories": 143.0,
      "protein": 12.56,
      "carbs": 0.72,
      "fat": 9.51
    },
    "pricePer100g": 0.5,
    "priceBasis": "Budget allowance $3/dozen, 50g edible per egg; example dozen $1.67",
    "priceSource": "https://www.walmart.com/c/kp/great-value-large-eggs"
  },
  "eggWhites": {
    "name": "pasteurized liquid egg whites",
    "fdcId": "172183",
    "usdaDescription": "Egg, white, raw, fresh",
    "per100g": {
      "calories": 52.0,
      "protein": 10.9,
      "carbs": 0.73,
      "fat": 0.17
    },
    "pricePer100g": 0.8,
    "priceBasis": "Budget assumption 16 oz carton $3.63",
    "priceSource": "https://www.walmart.com/c/kp/great-value-large-eggs"
  },
  "rice": {
    "name": "cooked white rice",
    "fdcId": "168878",
    "usdaDescription": "Rice, white, long-grain, regular, enriched, cooked",
    "per100g": {
      "calories": 130.0,
      "protein": 2.69,
      "carbs": 28.17,
      "fat": 0.28
    },
    "pricePer100g": 0.16,
    "priceBasis": "Budget assumption dry rice $2/lb, 2.75x cooked yield",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "brownRice": {
    "name": "cooked brown rice",
    "fdcId": "169704",
    "usdaDescription": "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)",
    "per100g": {
      "calories": 123.0,
      "protein": 2.74,
      "carbs": 25.58,
      "fat": 0.97
    },
    "pricePer100g": 0.2,
    "priceBasis": "Budget assumption dry rice $2.50/lb, 2.75x cooked yield",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "quinoa": {
    "name": "cooked quinoa",
    "fdcId": "168917",
    "usdaDescription": "Quinoa, cooked",
    "per100g": {
      "calories": 120.0,
      "protein": 4.4,
      "carbs": 21.3,
      "fat": 1.92
    },
    "pricePer100g": 0.37,
    "priceBasis": "Budget assumption dry quinoa $5/lb, 3x cooked yield",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "oats": {
    "name": "dry rolled oats",
    "fdcId": "173904",
    "usdaDescription": "Cereals, oats, regular and quick, not fortified, dry",
    "per100g": {
      "calories": 379.0,
      "protein": 13.15,
      "carbs": 67.7,
      "fat": 6.52
    },
    "pricePer100g": 0.36,
    "priceBasis": "Budget assumption 42 oz oats $4.29",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "pasta": {
    "name": "dry whole-wheat pasta",
    "fdcId": "169738",
    "usdaDescription": "Pasta, whole-wheat, dry (Includes foods for USDA's Food Distribution Program)",
    "per100g": {
      "calories": 352.0,
      "protein": 13.87,
      "carbs": 73.37,
      "fat": 2.93
    },
    "pricePer100g": 0.4,
    "priceBasis": "Budget assumption 16 oz pasta $1.81",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "bread": {
    "name": "whole-wheat bread",
    "fdcId": "172688",
    "usdaDescription": "Bread, whole-wheat, commercially prepared",
    "per100g": {
      "calories": 252.0,
      "protein": 12.45,
      "carbs": 42.71,
      "fat": 3.5
    },
    "pricePer100g": 0.53,
    "priceBasis": "Budget assumption 20 oz loaf $3",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "pita": {
    "name": "whole-wheat pita",
    "fdcId": "174916",
    "usdaDescription": "Bread, pita, whole-wheat",
    "per100g": {
      "calories": 262.0,
      "protein": 9.8,
      "carbs": 55.89,
      "fat": 1.71
    },
    "pricePer100g": 0.55,
    "priceBasis": "Budget assumption 340g pack $1.87",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "tortilla": {
    "name": "flour tortillas made with vegetable oil",
    "fdcId": "167535",
    "usdaDescription": "Tortillas, ready-to-bake or -fry, flour, shelf stable",
    "per100g": {
      "calories": 297.0,
      "protein": 8.01,
      "carbs": 49.27,
      "fat": 7.58
    },
    "pricePer100g": 0.55,
    "priceBasis": "Budget assumption 680g pack $3.74",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "potato": {
    "name": "potato, scrubbed and diced",
    "fdcId": "170026",
    "usdaDescription": "Potatoes, flesh and skin, raw",
    "per100g": {
      "calories": 77.0,
      "protein": 2.05,
      "carbs": 17.49,
      "fat": 0.09
    },
    "pricePer100g": 0.22,
    "priceBasis": "Budget assumption $1/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "sweetPotato": {
    "name": "sweet potato, scrubbed and diced",
    "fdcId": "168482",
    "usdaDescription": "Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)",
    "per100g": {
      "calories": 86.0,
      "protein": 1.57,
      "carbs": 20.12,
      "fat": 0.05
    },
    "pricePer100g": 0.3,
    "priceBasis": "Budget assumption $1.36/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "peas": {
    "name": "frozen green peas, cooked",
    "fdcId": "170017",
    "usdaDescription": "Peas, green, frozen, cooked, boiled, drained, without salt",
    "per100g": {
      "calories": 78.0,
      "protein": 5.15,
      "carbs": 14.26,
      "fat": 0.27
    },
    "pricePer100g": 0.32,
    "priceBasis": "Budget assumption 12 oz bag $1.09",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "corn": {
    "name": "frozen corn, cooked",
    "fdcId": "168399",
    "usdaDescription": "Corn, sweet, yellow, frozen, kernels cut off cob, boiled, drained, without salt",
    "per100g": {
      "calories": 81.0,
      "protein": 2.55,
      "carbs": 19.3,
      "fat": 0.67
    },
    "pricePer100g": 0.32,
    "priceBasis": "Budget assumption 12 oz bag $1.09",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "milk": {
    "name": "2% milk",
    "fdcId": "171267",
    "usdaDescription": "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D",
    "per100g": {
      "calories": 50.0,
      "protein": 3.3,
      "carbs": 4.8,
      "fat": 1.98
    },
    "pricePer100g": 0.09,
    "priceBasis": "Budget assumption gallon $3.41",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "peanutButter": {
    "name": "smooth peanut butter",
    "fdcId": "174266",
    "usdaDescription": "Peanut butter, smooth style, with salt (Includes foods for USDA's Food Distribution Program)",
    "per100g": {
      "calories": 598.0,
      "protein": 22.21,
      "carbs": 22.31,
      "fat": 51.36
    },
    "pricePer100g": 0.45,
    "priceBasis": "Budget assumption 16 oz jar $2.04",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "cheddar": {
    "name": "shredded cheddar",
    "fdcId": "173414",
    "usdaDescription": "Cheese, cheddar (Includes foods for USDA's Food Distribution Program)",
    "per100g": {
      "calories": 403.0,
      "protein": 22.87,
      "carbs": 3.37,
      "fat": 33.31
    },
    "pricePer100g": 0.9,
    "priceBasis": "Budget assumption 8 oz bag $2.04",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "feta": {
    "name": "crumbled feta",
    "fdcId": "173420",
    "usdaDescription": "Cheese, feta",
    "per100g": {
      "calories": 265.0,
      "protein": 14.21,
      "carbs": 3.88,
      "fat": 21.49
    },
    "pricePer100g": 1.35,
    "priceBasis": "Budget assumption 6 oz tub $2.30",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "banana": {
    "name": "banana, peeled",
    "fdcId": "173944",
    "usdaDescription": "Bananas, raw",
    "per100g": {
      "calories": 89.0,
      "protein": 1.09,
      "carbs": 22.84,
      "fat": 0.33
    },
    "pricePer100g": 0.15,
    "priceBasis": "Budget assumption $0.68/lb edible equivalent",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "apple": {
    "name": "apple, cored and diced",
    "fdcId": "171688",
    "usdaDescription": "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)",
    "per100g": {
      "calories": 52.0,
      "protein": 0.26,
      "carbs": 13.81,
      "fat": 0.17
    },
    "pricePer100g": 0.37,
    "priceBasis": "Budget assumption $1.68/lb edible equivalent",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "berries": {
    "name": "strawberries, fresh or thawed",
    "fdcId": "167762",
    "usdaDescription": "Strawberries, raw",
    "per100g": {
      "calories": 32.0,
      "protein": 0.67,
      "carbs": 7.68,
      "fat": 0.3
    },
    "pricePer100g": 0.65,
    "priceBasis": "Budget assumption frozen or seasonal fruit $2.95/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "blueberries": {
    "name": "blueberries, fresh or thawed",
    "fdcId": "171711",
    "usdaDescription": "Blueberries, raw",
    "per100g": {
      "calories": 57.0,
      "protein": 0.74,
      "carbs": 14.49,
      "fat": 0.33
    },
    "pricePer100g": 0.85,
    "priceBasis": "Budget assumption frozen blueberries $3.86/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "peach": {
    "name": "peaches, pitted and sliced",
    "fdcId": "169928",
    "usdaDescription": "Peaches, yellow, raw",
    "per100g": {
      "calories": 39.0,
      "protein": 0.91,
      "carbs": 9.54,
      "fat": 0.25
    },
    "pricePer100g": 0.44,
    "priceBasis": "Budget assumption frozen or seasonal peaches $2/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "raisins": {
    "name": "raisins",
    "fdcId": "168165",
    "usdaDescription": "Raisins, dark, seedless (Includes foods for USDA's Food Distribution Program)",
    "per100g": {
      "calories": 299.0,
      "protein": 3.3,
      "carbs": 79.32,
      "fat": 0.25
    },
    "pricePer100g": 0.55,
    "priceBasis": "Budget assumption 12 oz box $1.87",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "cocoa": {
    "name": "unsweetened cocoa powder",
    "fdcId": "169593",
    "usdaDescription": "Cocoa, dry powder, unsweetened",
    "per100g": {
      "calories": 228.0,
      "protein": 19.6,
      "carbs": 57.9,
      "fat": 13.7
    },
    "pricePer100g": 1.5,
    "priceBasis": "Budget assumption 8 oz container $3.40",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "chia": {
    "name": "chia seeds",
    "fdcId": "170554",
    "usdaDescription": "Seeds, chia seeds, dried",
    "per100g": {
      "calories": 486.0,
      "protein": 16.54,
      "carbs": 42.12,
      "fat": 30.74
    },
    "pricePer100g": 1.1,
    "priceBasis": "Budget assumption 12 oz bag $3.74",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "honey": {
    "name": "honey",
    "fdcId": "169640",
    "usdaDescription": "Honey",
    "per100g": {
      "calories": 304.0,
      "protein": 0.3,
      "carbs": 82.4,
      "fat": 0.0
    },
    "pricePer100g": 0.78,
    "priceBasis": "Budget assumption 12 oz bottle $2.65",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "broccoli": {
    "name": "broccoli florets",
    "fdcId": "170379",
    "usdaDescription": "Broccoli, raw",
    "per100g": {
      "calories": 34.0,
      "protein": 2.82,
      "carbs": 6.64,
      "fat": 0.37
    },
    "pricePer100g": 0.4,
    "priceBasis": "Budget assumption fresh or frozen broccoli $1.81/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "cauliflower": {
    "name": "cauliflower florets",
    "fdcId": "169986",
    "usdaDescription": "Cauliflower, raw",
    "per100g": {
      "calories": 25.0,
      "protein": 1.92,
      "carbs": 4.97,
      "fat": 0.28
    },
    "pricePer100g": 0.4,
    "priceBasis": "Budget assumption fresh or frozen cauliflower $1.81/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "spinach": {
    "name": "spinach",
    "fdcId": "168462",
    "usdaDescription": "Spinach, raw",
    "per100g": {
      "calories": 23.0,
      "protein": 2.86,
      "carbs": 3.63,
      "fat": 0.39
    },
    "pricePer100g": 0.75,
    "priceBasis": "Budget assumption 10 oz bag $2.13",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "cabbage": {
    "name": "cabbage, finely sliced",
    "fdcId": "169975",
    "usdaDescription": "Cabbage, raw",
    "per100g": {
      "calories": 25.0,
      "protein": 1.28,
      "carbs": 5.8,
      "fat": 0.1
    },
    "pricePer100g": 0.2,
    "priceBasis": "Budget assumption $0.91/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "carrot": {
    "name": "carrot, grated or thinly sliced",
    "fdcId": "170393",
    "usdaDescription": "Carrots, raw",
    "per100g": {
      "calories": 41.0,
      "protein": 0.93,
      "carbs": 9.58,
      "fat": 0.24
    },
    "pricePer100g": 0.22,
    "priceBasis": "Budget assumption 2 lb bag $2",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "onion": {
    "name": "onion, diced",
    "fdcId": "170000",
    "usdaDescription": "Onions, raw",
    "per100g": {
      "calories": 40.0,
      "protein": 1.1,
      "carbs": 9.34,
      "fat": 0.1
    },
    "pricePer100g": 0.28,
    "priceBasis": "Budget assumption $1.27/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "pepper": {
    "name": "bell pepper, sliced",
    "fdcId": "170108",
    "usdaDescription": "Peppers, sweet, red, raw",
    "per100g": {
      "calories": 26.0,
      "protein": 0.99,
      "carbs": 6.03,
      "fat": 0.3
    },
    "pricePer100g": 0.58,
    "priceBasis": "Budget assumption $1.05 per 180g pepper",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "tomato": {
    "name": "tomato, diced",
    "fdcId": "170457",
    "usdaDescription": "Tomatoes, red, ripe, raw, year round average",
    "per100g": {
      "calories": 18.0,
      "protein": 0.88,
      "carbs": 3.89,
      "fat": 0.2
    },
    "pricePer100g": 0.4,
    "priceBasis": "Budget assumption $1.81/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "cannedTomato": {
    "name": "canned diced tomatoes with juices",
    "fdcId": "170138",
    "usdaDescription": "Tomatoes, red, ripe, canned, packed in tomato juice, no salt added",
    "per100g": {
      "calories": 16.0,
      "protein": 0.79,
      "carbs": 3.47,
      "fat": 0.25
    },
    "pricePer100g": 0.25,
    "priceBasis": "Budget assumption 14.5 oz can $1.03",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "tomatoSauce": {
    "name": "plain tomato sauce",
    "fdcId": "170054",
    "usdaDescription": "Tomato products, canned, sauce",
    "per100g": {
      "calories": 24.0,
      "protein": 1.2,
      "carbs": 5.31,
      "fat": 0.3
    },
    "pricePer100g": 0.3,
    "priceBasis": "Budget assumption 15 oz can $1.28",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "cucumber": {
    "name": "cucumber, diced",
    "fdcId": "168409",
    "usdaDescription": "Cucumber, with peel, raw",
    "per100g": {
      "calories": 15.0,
      "protein": 0.65,
      "carbs": 3.63,
      "fat": 0.11
    },
    "pricePer100g": 0.25,
    "priceBasis": "Budget assumption $0.75 per 300g cucumber",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "zucchini": {
    "name": "zucchini, diced",
    "fdcId": "169291",
    "usdaDescription": "Squash, summer, zucchini, includes skin, raw",
    "per100g": {
      "calories": 17.0,
      "protein": 1.21,
      "carbs": 3.11,
      "fat": 0.32
    },
    "pricePer100g": 0.32,
    "priceBasis": "Budget assumption $1.45/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "mushroom": {
    "name": "white mushrooms, sliced",
    "fdcId": "169251",
    "usdaDescription": "Mushrooms, white, raw",
    "per100g": {
      "calories": 22.0,
      "protein": 3.09,
      "carbs": 3.26,
      "fat": 0.34
    },
    "pricePer100g": 0.75,
    "priceBasis": "Budget assumption 8 oz pack $1.70",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "lettuce": {
    "name": "lettuce, chopped",
    "fdcId": "169249",
    "usdaDescription": "Lettuce, green leaf, raw",
    "per100g": {
      "calories": 15.0,
      "protein": 1.36,
      "carbs": 2.87,
      "fat": 0.15
    },
    "pricePer100g": 0.55,
    "priceBasis": "Budget assumption $1.98 per 360g head",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "garlic": {
    "name": "garlic, minced",
    "fdcId": "169230",
    "usdaDescription": "Garlic, raw",
    "per100g": {
      "calories": 149.0,
      "protein": 6.36,
      "carbs": 33.06,
      "fat": 0.5
    },
    "pricePer100g": 1,
    "priceBasis": "Budget assumption $0.60 per 60g bulb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "ginger": {
    "name": "fresh ginger, grated",
    "fdcId": "169231",
    "usdaDescription": "Ginger root, raw",
    "per100g": {
      "calories": 80.0,
      "protein": 1.82,
      "carbs": 17.77,
      "fat": 0.75
    },
    "pricePer100g": 0.88,
    "priceBasis": "Budget assumption $3.99/lb",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "lemon": {
    "name": "lemon juice",
    "fdcId": "167747",
    "usdaDescription": "Lemon juice, raw",
    "per100g": {
      "calories": 22.0,
      "protein": 0.35,
      "carbs": 6.9,
      "fat": 0.24
    },
    "pricePer100g": 1.2,
    "priceBasis": "Budget assumption $0.58 lemon yielding 48g juice",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "lime": {
    "name": "lime juice",
    "fdcId": "168156",
    "usdaDescription": "Lime juice, raw",
    "per100g": {
      "calories": 25.0,
      "protein": 0.42,
      "carbs": 8.42,
      "fat": 0.07
    },
    "pricePer100g": 1.3,
    "priceBasis": "Budget assumption $0.50 lime yielding 38g juice",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "soy": {
    "name": "reduced-sodium soy sauce",
    "fdcId": "172473",
    "usdaDescription": "Soy sauce made from soy and wheat (shoyu), low sodium",
    "per100g": {
      "calories": 57.0,
      "protein": 9.05,
      "carbs": 5.59,
      "fat": 0.3
    },
    "pricePer100g": 0.63,
    "priceBasis": "Budget assumption 296mL bottle $1.98",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "mustard": {
    "name": "prepared yellow mustard",
    "fdcId": "172234",
    "usdaDescription": "Mustard, prepared, yellow",
    "per100g": {
      "calories": 60.0,
      "protein": 3.74,
      "carbs": 5.83,
      "fat": 3.34
    },
    "pricePer100g": 0.35,
    "priceBasis": "Budget assumption 20 oz bottle $1.98",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "salsa": {
    "name": "tomato salsa",
    "fdcId": "174524",
    "usdaDescription": "Sauce, salsa, ready-to-serve",
    "per100g": {
      "calories": 29.0,
      "protein": 1.52,
      "carbs": 6.64,
      "fat": 0.17
    },
    "pricePer100g": 0.3,
    "priceBasis": "Budget assumption 24 oz jar $2.04",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "oil": {
    "name": "olive oil",
    "fdcId": "171413",
    "usdaDescription": "Oil, olive, salad or cooking",
    "per100g": {
      "calories": 884.0,
      "protein": 0.0,
      "carbs": 0.0,
      "fat": 100.0
    },
    "pricePer100g": 1.25,
    "priceBasis": "Budget assumption 500mL bottle $5.69; density 0.91g/mL",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "sesameOil": {
    "name": "toasted sesame oil",
    "fdcId": "171016",
    "usdaDescription": "Oil, sesame, salad or cooking",
    "per100g": {
      "calories": 884.0,
      "protein": 0.0,
      "carbs": 0.0,
      "fat": 100.0
    },
    "pricePer100g": 2.2,
    "priceBasis": "Budget assumption 148mL bottle $2.99; density 0.92g/mL",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "vinegar": {
    "name": "unseasoned vinegar",
    "fdcId": "172237",
    "usdaDescription": "Vinegar, distilled",
    "per100g": {
      "calories": 18.0,
      "protein": 0.0,
      "carbs": 0.04,
      "fat": 0.0
    },
    "pricePer100g": 0.2,
    "priceBasis": "Budget assumption pantry vinegar $0.02 per tbsp",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "cumin": {
    "name": "ground cumin",
    "fdcId": "170923",
    "usdaDescription": "Spices, cumin seed",
    "per100g": {
      "calories": 375.0,
      "protein": 17.81,
      "carbs": 44.24,
      "fat": 22.27
    },
    "pricePer100g": 2,
    "priceBasis": "Budget spice allowance $0.02 per gram",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "paprika": {
    "name": "paprika",
    "fdcId": "171329",
    "usdaDescription": "Spices, paprika",
    "per100g": {
      "calories": 282.0,
      "protein": 14.14,
      "carbs": 53.99,
      "fat": 12.89
    },
    "pricePer100g": 2,
    "priceBasis": "Budget spice allowance $0.02 per gram",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "chili": {
    "name": "chili powder",
    "fdcId": "171319",
    "usdaDescription": "Spices, chili powder",
    "per100g": {
      "calories": 282.0,
      "protein": 13.46,
      "carbs": 49.7,
      "fat": 14.28
    },
    "pricePer100g": 2,
    "priceBasis": "Budget spice allowance $0.02 per gram",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "cinnamon": {
    "name": "ground cinnamon",
    "fdcId": "171320",
    "usdaDescription": "Spices, cinnamon, ground",
    "per100g": {
      "calories": 247.0,
      "protein": 3.99,
      "carbs": 80.59,
      "fat": 1.24
    },
    "pricePer100g": 2,
    "priceBasis": "Budget spice allowance $0.02 per gram",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "oregano": {
    "name": "dried oregano",
    "fdcId": "171328",
    "usdaDescription": "Spices, oregano, dried",
    "per100g": {
      "calories": 265.0,
      "protein": 9.0,
      "carbs": 68.92,
      "fat": 4.28
    },
    "pricePer100g": 3,
    "priceBasis": "Budget spice allowance $0.03 per gram",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "curry": {
    "name": "curry powder",
    "fdcId": "170924",
    "usdaDescription": "Spices, curry powder",
    "per100g": {
      "calories": 325.0,
      "protein": 14.29,
      "carbs": 55.83,
      "fat": 14.01
    },
    "pricePer100g": 2,
    "priceBasis": "Budget spice allowance $0.02 per gram",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  },
  "blackPepper": {
    "name": "ground black pepper",
    "fdcId": "170931",
    "usdaDescription": "Spices, pepper, black",
    "per100g": {
      "calories": 251.0,
      "protein": 10.39,
      "carbs": 63.95,
      "fat": 3.26
    },
    "pricePer100g": 2,
    "priceBasis": "Budget spice allowance $0.02 per gram",
    "priceSource": "https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md"
  }
};
