# 100 high-protein budget meals

Research reviewed October 14, 2026. This collection adds 100 original Stevies World recipes: 20 breakfasts, 40 lunches, and 40 dinners. The six existing recipes remain available. These are original cooking instructions supported by ingredient research; they have not been kitchen-tested.

## Criteria and serving basis

Every new meal has at least **25 g protein per serving before rounding** and an estimated ingredient cost of **$4 USD or less per serving** under the documented price assumptions. This is a collection rule, not a personalized protein recommendation.

The raw plans in [data/meal-plans.js](data/meal-plans.js) specify grams **per serving**. [budget-meals.js](budget-meals.js) multiplies these amounts by the recipe serving count for the displayed ingredient list, sums USDA nutrients per 100 g for one serving, and multiplies the ingredient cost by servings for the whole-recipe cost. There is a $0.03 per-serving pantry allowance for optional salt and pepper. Calories round to 10 kcal; displayed macros round to 0.1 g; whole-recipe cost rounds to cents. Whole-recipe UI macros scale the displayed per-serving estimates.

Cooked rice, quinoa, and lentils are starting ingredients. Listed meal times assume those are already cooked; allow extra time to cook them from dry. Canned beans are drained and rinsed. Weights for chicken, turkey, and beef are **raw**; pasta and oats are **dry**; canned fish is **drained**. Eggs use 50 g edible weight per large egg. Vegetable and fruit weights are edible portions. Frozen produce can be used where suitable, following its package cooking instructions.

## Research sources

- [USDA FoodData Central downloadable SR Legacy dataset](https://fdc.nal.usda.gov/download-datasets/): ingredient-specific energy, protein, carbohydrate, and fat data. The April 2018 SR Legacy release is a published composition reference; it is not a 2026 retail label database. Each ingredient below links to its actual food ID.
- [FoodSafety.gov safe internal temperatures](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures): poultry 165°F, ground beef 160°F, egg dishes 160°F; eggs cooked until firm.
- [USDA leftovers guidance](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety): prompt refrigeration, 3–4 days refrigerated storage, and reheating hot leftovers to 165°F.
- [USDA baked tofu cooking reference](https://www.nutrition.gov/recipes/baked-tofu-bites), [University of Missouri Extension tuna ideas](https://extension.missouri.edu/publications/n662), and [MedlinePlus vegetarian recipe collection](https://medlineplus.gov/recipes/vegetarian/) were reviewed for general cooking context. The recipes here use original quantities and wording.

## What the costs mean

Costs are estimates for the **quantities consumed**, not the checkout price for every full package. Online retailer examples may be location-specific, indexed, promotional, or unavailable at a given store. Budget assumptions are deliberately labeled; they are not advertised prices. Tax, delivery, equipment, energy, and spoilage are excluded. Produce prices assume edible-portion equivalents unless otherwise noted. Drained canned beans and fish allocate the can price to the assumed drained weight. Buying bulk, substitutions, and local pricing change the result.

Representative online examples reviewed include [frozen chicken $3.28/lb](https://www.walmart.com/browse/food/chicken-breasts/great-value/976759_9569500_1001443_8161643/YnJhbmQ6R3JlYXQgVmFsdWUie), [93% lean turkey $5.56/lb](https://www.walmart.com/c/kp/butterball-ground-turkey), [5 oz light tuna $0.96](https://www.walmart.com/ip/11965048), [14 oz tofu $2.92](https://www.walmart.com/c/kp/firm-tofu), [32 oz Greek yogurt $3.28](https://www.walmart.com/c/best-sellers/great-value-plain-greek-yogurt), [24 oz fat-free cottage cheese $2.87](https://www.walmart.com/c/kp/cottage-cheese-great-value), [a dozen eggs $1.67](https://www.walmart.com/c/kp/great-value-large-eggs), and [15 oz black beans $0.86](https://www.walmart.com/browse/food/beans/976759_976794_4879140_6822160). The calculation often uses a higher allowance (e.g. chicken $4/lb, eggs $3/dozen, tuna $1.20/can); cottage cheese uses an assumed $3.25 tub for the 2% variety instead of substituting the fat-free example price.

## Ingredient data and price assumptions

Canned legumes other than chickpeas use a cooked-boiled USDA nutrient proxy; canned brands may differ. Firm tofu uses the conservative USDA entry at approximately 9 g protein per 100 g rather than a much higher-protein pressed tofu entry. Greek yogurt is nonfat, cottage cheese is 2%, milk is 2%, and turkey is 93% lean. Alternative products change the estimates. Choose plant-based tortillas where a recipe is labeled plant based.

| Ingredient | USDA food ID | kcal / 100 g | Protein / 100 g | Budget cost / 100 g | Price basis |
| --- | --- | ---: | ---: | ---: | --- |
| raw boneless skinless chicken breast | [171077](https://fdc.nal.usda.gov/food-details/171077/nutrients) | 120 | 22.5 g | $0.88 | Budget allowance $4/lb; frozen chicken reference $3.28/lb |
| raw 93% lean ground turkey | [172850](https://fdc.nal.usda.gov/food-details/172850/nutrients) | 150 | 18.73 g | $1.23 | Representative 1 lb tray $5.56 |
| raw 90% lean ground beef | [174030](https://fdc.nal.usda.gov/food-details/174030/nutrients) | 176 | 20 g | $1.54 | Budget assumption $7/lb |
| canned light tuna in water, drained | [173709](https://fdc.nal.usda.gov/food-details/173709/nutrients) | 86 | 19.44 g | $1.06 | Budget allowance $1.20 per can yielding 113g drained; example can $0.96 |
| canned pink salmon, drained, skin and bones removed | [173724](https://fdc.nal.usda.gov/food-details/173724/nutrients) | 136 | 24.62 g | $1.50 | Budget assumption $3 per 200g drained |
| firm tofu, drained | [175236](https://fdc.nal.usda.gov/food-details/175236/nutrients) | 80 | 9.08 g | $0.74 | Representative extra-firm tofu $2.92 per 14 oz |
| shelled edamame, cooked | [169283](https://fdc.nal.usda.gov/food-details/169283/nutrients) | 141 | 12.35 g | $0.80 | Budget assumption $2.72 per 340g shelled bag |
| cooked lentils, drained | [172421](https://fdc.nal.usda.gov/food-details/172421/nutrients) | 116 | 9.02 g | $0.20 | Budget assumption dried lentils $2.25/lb, 2.5x cooked yield |
| canned black beans, drained and rinsed | [173735](https://fdc.nal.usda.gov/food-details/173735/nutrients) | 132 | 8.86 g | $0.39 | Budget allowance $1 per 255g drained; example 15 oz can $0.86 |
| canned kidney beans, drained and rinsed | [175194](https://fdc.nal.usda.gov/food-details/175194/nutrients) | 127 | 8.67 g | $0.39 | Budget assumption $1 per 255g drained |
| canned white beans, drained and rinsed | [175203](https://fdc.nal.usda.gov/food-details/175203/nutrients) | 139 | 9.73 g | $0.43 | Budget assumption $1.10 per 255g drained |
| canned chickpeas, drained and rinsed | [173801](https://fdc.nal.usda.gov/food-details/173801/nutrients) | 138 | 7.04 g | $0.48 | Budget assumption $1.22 per 254g drained |
| plain nonfat Greek yogurt | [170894](https://fdc.nal.usda.gov/food-details/170894/nutrients) | 59 | 10.19 g | $0.36 | Representative 32 oz tub $3.28 |
| 2% cottage cheese | [172182](https://fdc.nal.usda.gov/food-details/172182/nutrients) | 81 | 10.45 g | $0.48 | Budget assumption 24 oz tub $3.25; representative fat-free tub $2.87 |
| large eggs, without shells | [171287](https://fdc.nal.usda.gov/food-details/171287/nutrients) | 143 | 12.56 g | $0.50 | Budget allowance $3/dozen, 50g edible per egg; example dozen $1.67 |
| pasteurized liquid egg whites | [172183](https://fdc.nal.usda.gov/food-details/172183/nutrients) | 52 | 10.9 g | $0.80 | Budget assumption 16 oz carton $3.63 |
| cooked white rice | [168878](https://fdc.nal.usda.gov/food-details/168878/nutrients) | 130 | 2.69 g | $0.16 | Budget assumption dry rice $2/lb, 2.75x cooked yield |
| cooked brown rice | [169704](https://fdc.nal.usda.gov/food-details/169704/nutrients) | 123 | 2.74 g | $0.20 | Budget assumption dry rice $2.50/lb, 2.75x cooked yield |
| cooked quinoa | [168917](https://fdc.nal.usda.gov/food-details/168917/nutrients) | 120 | 4.4 g | $0.37 | Budget assumption dry quinoa $5/lb, 3x cooked yield |
| dry rolled oats | [173904](https://fdc.nal.usda.gov/food-details/173904/nutrients) | 379 | 13.15 g | $0.36 | Budget assumption 42 oz oats $4.29 |
| dry whole-wheat pasta | [169738](https://fdc.nal.usda.gov/food-details/169738/nutrients) | 352 | 13.87 g | $0.40 | Budget assumption 16 oz pasta $1.81 |
| whole-wheat bread | [172688](https://fdc.nal.usda.gov/food-details/172688/nutrients) | 252 | 12.45 g | $0.53 | Budget assumption 20 oz loaf $3 |
| whole-wheat pita | [174916](https://fdc.nal.usda.gov/food-details/174916/nutrients) | 262 | 9.8 g | $0.55 | Budget assumption 340g pack $1.87 |
| flour tortillas made with vegetable oil | [167535](https://fdc.nal.usda.gov/food-details/167535/nutrients) | 297 | 8.01 g | $0.55 | Budget assumption 680g pack $3.74 |
| potato, scrubbed and diced | [170026](https://fdc.nal.usda.gov/food-details/170026/nutrients) | 77 | 2.05 g | $0.22 | Budget assumption $1/lb |
| sweet potato, scrubbed and diced | [168482](https://fdc.nal.usda.gov/food-details/168482/nutrients) | 86 | 1.57 g | $0.30 | Budget assumption $1.36/lb |
| frozen green peas, cooked | [170017](https://fdc.nal.usda.gov/food-details/170017/nutrients) | 78 | 5.15 g | $0.32 | Budget assumption 12 oz bag $1.09 |
| frozen corn, cooked | [168399](https://fdc.nal.usda.gov/food-details/168399/nutrients) | 81 | 2.55 g | $0.32 | Budget assumption 12 oz bag $1.09 |
| 2% milk | [171267](https://fdc.nal.usda.gov/food-details/171267/nutrients) | 50 | 3.3 g | $0.09 | Budget assumption gallon $3.41 |
| smooth peanut butter | [174266](https://fdc.nal.usda.gov/food-details/174266/nutrients) | 598 | 22.21 g | $0.45 | Budget assumption 16 oz jar $2.04 |
| shredded cheddar | [173414](https://fdc.nal.usda.gov/food-details/173414/nutrients) | 403 | 22.87 g | $0.90 | Budget assumption 8 oz bag $2.04 |
| crumbled feta | [173420](https://fdc.nal.usda.gov/food-details/173420/nutrients) | 265 | 14.21 g | $1.35 | Budget assumption 6 oz tub $2.30 |
| banana, peeled | [173944](https://fdc.nal.usda.gov/food-details/173944/nutrients) | 89 | 1.09 g | $0.15 | Budget assumption $0.68/lb edible equivalent |
| apple, cored and diced | [171688](https://fdc.nal.usda.gov/food-details/171688/nutrients) | 52 | 0.26 g | $0.37 | Budget assumption $1.68/lb edible equivalent |
| strawberries, fresh or thawed | [167762](https://fdc.nal.usda.gov/food-details/167762/nutrients) | 32 | 0.67 g | $0.65 | Budget assumption frozen or seasonal fruit $2.95/lb |
| blueberries, fresh or thawed | [171711](https://fdc.nal.usda.gov/food-details/171711/nutrients) | 57 | 0.74 g | $0.85 | Budget assumption frozen blueberries $3.86/lb |
| peaches, pitted and sliced | [169928](https://fdc.nal.usda.gov/food-details/169928/nutrients) | 39 | 0.91 g | $0.44 | Budget assumption frozen or seasonal peaches $2/lb |
| raisins | [168165](https://fdc.nal.usda.gov/food-details/168165/nutrients) | 299 | 3.3 g | $0.55 | Budget assumption 12 oz box $1.87 |
| unsweetened cocoa powder | [169593](https://fdc.nal.usda.gov/food-details/169593/nutrients) | 228 | 19.6 g | $1.50 | Budget assumption 8 oz container $3.40 |
| chia seeds | [170554](https://fdc.nal.usda.gov/food-details/170554/nutrients) | 486 | 16.54 g | $1.10 | Budget assumption 12 oz bag $3.74 |
| honey | [169640](https://fdc.nal.usda.gov/food-details/169640/nutrients) | 304 | 0.3 g | $0.78 | Budget assumption 12 oz bottle $2.65 |
| broccoli florets | [170379](https://fdc.nal.usda.gov/food-details/170379/nutrients) | 34 | 2.82 g | $0.40 | Budget assumption fresh or frozen broccoli $1.81/lb |
| cauliflower florets | [169986](https://fdc.nal.usda.gov/food-details/169986/nutrients) | 25 | 1.92 g | $0.40 | Budget assumption fresh or frozen cauliflower $1.81/lb |
| spinach | [168462](https://fdc.nal.usda.gov/food-details/168462/nutrients) | 23 | 2.86 g | $0.75 | Budget assumption 10 oz bag $2.13 |
| cabbage, finely sliced | [169975](https://fdc.nal.usda.gov/food-details/169975/nutrients) | 25 | 1.28 g | $0.20 | Budget assumption $0.91/lb |
| carrot, grated or thinly sliced | [170393](https://fdc.nal.usda.gov/food-details/170393/nutrients) | 41 | 0.93 g | $0.22 | Budget assumption 2 lb bag $2 |
| onion, diced | [170000](https://fdc.nal.usda.gov/food-details/170000/nutrients) | 40 | 1.1 g | $0.28 | Budget assumption $1.27/lb |
| bell pepper, sliced | [170108](https://fdc.nal.usda.gov/food-details/170108/nutrients) | 26 | 0.99 g | $0.58 | Budget assumption $1.05 per 180g pepper |
| tomato, diced | [170457](https://fdc.nal.usda.gov/food-details/170457/nutrients) | 18 | 0.88 g | $0.40 | Budget assumption $1.81/lb |
| canned diced tomatoes with juices | [170138](https://fdc.nal.usda.gov/food-details/170138/nutrients) | 16 | 0.79 g | $0.25 | Budget assumption 14.5 oz can $1.03 |
| plain tomato sauce | [170054](https://fdc.nal.usda.gov/food-details/170054/nutrients) | 24 | 1.2 g | $0.30 | Budget assumption 15 oz can $1.28 |
| cucumber, diced | [168409](https://fdc.nal.usda.gov/food-details/168409/nutrients) | 15 | 0.65 g | $0.25 | Budget assumption $0.75 per 300g cucumber |
| zucchini, diced | [169291](https://fdc.nal.usda.gov/food-details/169291/nutrients) | 17 | 1.21 g | $0.32 | Budget assumption $1.45/lb |
| white mushrooms, sliced | [169251](https://fdc.nal.usda.gov/food-details/169251/nutrients) | 22 | 3.09 g | $0.75 | Budget assumption 8 oz pack $1.70 |
| lettuce, chopped | [169249](https://fdc.nal.usda.gov/food-details/169249/nutrients) | 15 | 1.36 g | $0.55 | Budget assumption $1.98 per 360g head |
| garlic, minced | [169230](https://fdc.nal.usda.gov/food-details/169230/nutrients) | 149 | 6.36 g | $1.00 | Budget assumption $0.60 per 60g bulb |
| fresh ginger, grated | [169231](https://fdc.nal.usda.gov/food-details/169231/nutrients) | 80 | 1.82 g | $0.88 | Budget assumption $3.99/lb |
| lemon juice | [167747](https://fdc.nal.usda.gov/food-details/167747/nutrients) | 22 | 0.35 g | $1.20 | Budget assumption $0.58 lemon yielding 48g juice |
| lime juice | [168156](https://fdc.nal.usda.gov/food-details/168156/nutrients) | 25 | 0.42 g | $1.30 | Budget assumption $0.50 lime yielding 38g juice |
| reduced-sodium soy sauce | [172473](https://fdc.nal.usda.gov/food-details/172473/nutrients) | 57 | 9.05 g | $0.63 | Budget assumption 296mL bottle $1.98 |
| prepared yellow mustard | [172234](https://fdc.nal.usda.gov/food-details/172234/nutrients) | 60 | 3.74 g | $0.35 | Budget assumption 20 oz bottle $1.98 |
| tomato salsa | [174524](https://fdc.nal.usda.gov/food-details/174524/nutrients) | 29 | 1.52 g | $0.30 | Budget assumption 24 oz jar $2.04 |
| olive oil | [171413](https://fdc.nal.usda.gov/food-details/171413/nutrients) | 884 | 0 g | $1.25 | Budget assumption 500mL bottle $5.69; density 0.91g/mL |
| toasted sesame oil | [171016](https://fdc.nal.usda.gov/food-details/171016/nutrients) | 884 | 0 g | $2.20 | Budget assumption 148mL bottle $2.99; density 0.92g/mL |
| unseasoned vinegar | [172237](https://fdc.nal.usda.gov/food-details/172237/nutrients) | 18 | 0 g | $0.20 | Budget assumption pantry vinegar $0.02 per tbsp |
| ground cumin | [170923](https://fdc.nal.usda.gov/food-details/170923/nutrients) | 375 | 17.81 g | $2.00 | Budget spice allowance $0.02 per gram |
| paprika | [171329](https://fdc.nal.usda.gov/food-details/171329/nutrients) | 282 | 14.14 g | $2.00 | Budget spice allowance $0.02 per gram |
| chili powder | [171319](https://fdc.nal.usda.gov/food-details/171319/nutrients) | 282 | 13.46 g | $2.00 | Budget spice allowance $0.02 per gram |
| ground cinnamon | [171320](https://fdc.nal.usda.gov/food-details/171320/nutrients) | 247 | 3.99 g | $2.00 | Budget spice allowance $0.02 per gram |
| dried oregano | [171328](https://fdc.nal.usda.gov/food-details/171328/nutrients) | 265 | 9 g | $3.00 | Budget spice allowance $0.03 per gram |
| curry powder | [170924](https://fdc.nal.usda.gov/food-details/170924/nutrients) | 325 | 14.29 g | $2.00 | Budget spice allowance $0.02 per gram |
| ground black pepper | [170931](https://fdc.nal.usda.gov/food-details/170931/nutrients) | 251 | 10.39 g | $2.00 | Budget spice allowance $0.02 per gram |

## The 100 meals

| Meal | Category | Servings | kcal / serving | Protein | Carbs | Fat | Est. cost / serving |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Banana peanut butter yogurt oats | Breakfast | 1 | 470 | 32.4 g | 62.2 g | 12 g | $1.21 |
| Apple cinnamon cottage cheese oats | Breakfast | 1 | 430 | 30 g | 63.3 g | 8.1 g | $1.79 |
| Strawberry Greek yogurt overnight oats | Breakfast | 1 | 430 | 35.5 g | 54.9 g | 7.9 g | $2.02 |
| Cocoa banana yogurt crunch bowl | Breakfast | 1 | 440 | 34.7 g | 59.5 g | 10.5 g | $1.37 |
| Carrot cake overnight oats | Breakfast | 1 | 400 | 32.8 g | 57.1 g | 4.9 g | $1.33 |
| Savory cottage cheese egg toast | Breakfast | 1 | 420 | 32.6 g | 41.8 g | 14 g | $1.85 |
| Black bean breakfast egg tacos | Breakfast | 1 | 540 | 32.8 g | 63.5 g | 17.9 g | $1.66 |
| Spinach cheddar breakfast skillet | Breakfast | 1 | 420 | 31.4 g | 30 g | 19 g | $2.22 |
| Turkey sweet potato breakfast hash | Breakfast | 1 | 440 | 30.5 g | 45.6 g | 16.3 g | $2.86 |
| Tofu edamame breakfast scramble | Breakfast | 1 | 410 | 31.3 g | 35.9 g | 17.7 g | $2.72 |
| Mediterranean egg white pita | Breakfast | 1 | 400 | 32.5 g | 40.1 g | 12.6 g | $2.67 |
| Cottage cheese oat pancakes | Breakfast | 1 | 430 | 31.1 g | 44.5 g | 14.8 g | $1.99 |
| Spinach cottage cheese frittata | Breakfast | 1 | 420 | 33.3 g | 31.7 g | 18.2 g | $2.24 |
| Peaches and toasted oat yogurt bowl | Breakfast | 1 | 420 | 34.4 g | 53.4 g | 9.1 g | $1.80 |
| Savory lentil and egg breakfast bowl | Breakfast | 1 | 450 | 37 g | 47.8 g | 14 g | $1.83 |
| Peanut banana yogurt smoothie bowl | Breakfast | 1 | 520 | 36.2 g | 66.4 g | 14.4 g | $1.32 |
| Blueberry cottage cheese baked oats | Breakfast | 1 | 470 | 32.2 g | 53.7 g | 14.8 g | $2.02 |
| Tomato chickpea breakfast eggs | Breakfast | 1 | 460 | 30.4 g | 47.8 g | 17.3 g | $2.07 |
| Tofu black bean breakfast burrito | Breakfast | 1 | 480 | 27.8 g | 62.1 g | 14.4 g | $2.31 |
| Tuna egg breakfast toast | Breakfast | 1 | 380 | 34.1 g | 35.1 g | 11.4 g | $2.31 |
| Chicken and black bean rice bowls | Lunch | 2 | 540 | 48.7 g | 64.2 g | 9 g | $2.60 |
| Lemon chicken white bean salad | Lunch | 2 | 430 | 44.1 g | 43 g | 9.3 g | $2.88 |
| Crunchy chicken cabbage wraps | Lunch | 2 | 470 | 44.6 g | 44.8 g | 12.8 g | $2.38 |
| Peanut chicken noodle salad | Lunch | 2 | 540 | 43.5 g | 59.6 g | 16.1 g | $2.07 |
| Chicken corn potato salad | Lunch | 2 | 450 | 42.9 g | 53.9 g | 7.7 g | $2.24 |
| Chickpea yogurt chicken pitas | Lunch | 2 | 490 | 44 g | 59.9 g | 9.9 g | $2.44 |
| Chicken lentil tomato soup | Lunch | 2 | 420 | 41.1 g | 48.6 g | 8.2 g | $2.13 |
| Creamy chicken and pea pasta | Lunch | 2 | 540 | 50.6 g | 66.3 g | 9.6 g | $2.17 |
| Turkey taco rice bowls | Lunch | 2 | 550 | 43 g | 58.9 g | 16.1 g | $2.93 |
| Turkey cabbage rice skillet | Lunch | 2 | 490 | 35.1 g | 50.4 g | 17.2 g | $2.69 |
| Turkey white bean vegetable soup | Lunch | 2 | 460 | 39.9 g | 45.4 g | 15.1 g | $3.06 |
| Turkey cucumber yogurt pitas | Lunch | 2 | 490 | 42.7 g | 44.1 g | 17.3 g | $3.23 |
| Turkey lentil sloppy toasts | Lunch | 2 | 560 | 42.5 g | 65.2 g | 15.9 g | $2.55 |
| Tuna white bean lemon salad | Lunch | 2 | 350 | 36.2 g | 42.3 g | 5.9 g | $2.65 |
| Tuna yogurt crunch wraps | Lunch | 2 | 360 | 35.7 g | 42.7 g | 6.4 g | $2.23 |
| Tuna and pea pasta salad | Lunch | 2 | 440 | 40.3 g | 67.3 g | 3.7 g | $2.12 |
| Tuna chickpea stuffed pitas | Lunch | 2 | 420 | 36.3 g | 62.4 g | 4.9 g | $2.34 |
| Tuna tomato cheddar melts | Lunch | 2 | 430 | 42.8 g | 41 g | 11.2 g | $2.45 |
| Tuna potato green pea bowls | Lunch | 2 | 390 | 37.4 g | 58 g | 2.1 g | $2.49 |
| Canned salmon white bean toasts | Lunch | 2 | 520 | 49.7 g | 65.4 g | 7.4 g | $2.95 |
| Salmon brown rice cucumber salad | Lunch | 2 | 430 | 41.8 g | 51.9 g | 6.9 g | $2.91 |
| Tofu peanut noodle bowls | Lunch | 2 | 510 | 28.1 g | 62.6 g | 19.1 g | $1.92 |
| Cumin tofu black bean bowls | Lunch | 2 | 460 | 27.2 g | 61.4 g | 12.5 g | $2.46 |
| Ginger edamame tofu rice salad | Lunch | 2 | 460 | 29 g | 54.5 g | 15.9 g | $2.42 |
| Paprika tofu chickpea pitas | Lunch | 2 | 470 | 27.1 g | 63.2 g | 13.9 g | $2.59 |
| Tofu lentil lettuce wraps | Lunch | 2 | 450 | 29 g | 63.1 g | 9.9 g | $2.17 |
| Edamame lentil chopped salad | Lunch | 2 | 460 | 32.3 g | 62.4 g | 12.5 g | $2.23 |
| Lentil cottage cheese stuffed potatoes | Lunch | 2 | 540 | 35.7 g | 88.1 g | 7.2 g | $2.04 |
| White bean cottage cheese salad | Lunch | 2 | 500 | 38.4 g | 77.8 g | 5.7 g | $2.53 |
| Chickpea yogurt pasta salad | Lunch | 2 | 520 | 37.4 g | 84.8 g | 6.4 g | $2.30 |
| Lentil egg salad sandwiches | Lunch | 2 | 540 | 40.3 g | 66.2 g | 13.4 g | $1.65 |
| Black bean cottage cheese quesadillas | Lunch | 2 | 620 | 35.5 g | 83.8 g | 16.8 g | $1.90 |
| Chickpea egg rice salad | Lunch | 2 | 500 | 30.8 g | 64.9 g | 14.2 g | $2.24 |
| Lentil pea tomato pasta bowls | Lunch | 2 | 620 | 33.6 g | 112.1 g | 7.4 g | $1.59 |
| Spiced lentil yogurt wraps | Lunch | 2 | 570 | 38.8 g | 85.7 g | 9.2 g | $1.74 |
| Beef and bean burrito bowls | Lunch | 2 | 550 | 37.5 g | 64.8 g | 15.5 g | $3.16 |
| Beef lentil cucumber pitas | Lunch | 2 | 570 | 43.9 g | 68.4 g | 15.1 g | $2.74 |
| Yogurt chicken slaw toasts | Lunch | 2 | 480 | 48.3 g | 47.9 g | 10 g | $2.33 |
| Tofu quinoa lemon salad | Lunch | 2 | 430 | 26 g | 49.8 g | 14.9 g | $2.76 |
| Turkey pepper pasta salad | Lunch | 2 | 520 | 43 g | 54.9 g | 17.2 g | $3.06 |
| Lemon chicken and potato tray bake | Dinner | 2 | 490 | 44.2 g | 54.5 g | 11 g | $2.79 |
| Chicken lentil tomato curry | Dinner | 2 | 590 | 53.2 g | 73.7 g | 9.4 g | $2.55 |
| Chicken pepper skillet fajitas | Dinner | 2 | 540 | 49 g | 52.3 g | 15.5 g | $3.20 |
| Ginger chicken broccoli rice | Dinner | 2 | 530 | 46.8 g | 62.9 g | 10.4 g | $2.70 |
| Chicken white bean tomato pan | Dinner | 2 | 500 | 52.2 g | 51.5 g | 10.2 g | $3.14 |
| Peanut chicken cabbage skillet | Dinner | 2 | 560 | 45.1 g | 56.9 g | 17.9 g | $2.46 |
| Chicken spinach tomato pasta | Dinner | 2 | 560 | 49 g | 72.5 g | 11 g | $2.94 |
| Chicken corn and bean chili | Dinner | 2 | 510 | 47 g | 63.2 g | 9.9 g | $2.79 |
| Chicken zucchini rice pan | Dinner | 2 | 480 | 43.2 g | 51.6 g | 11.4 g | $2.80 |
| Chicken chickpea cumin stew | Dinner | 2 | 480 | 42.5 g | 53.9 g | 12.2 g | $2.77 |
| Turkey kidney bean chili | Dinner | 2 | 530 | 44.6 g | 52.6 g | 17.7 g | $3.68 |
| Turkey lentil bolognese | Dinner | 2 | 660 | 45.6 g | 91.6 g | 16.1 g | $2.86 |
| Unstuffed turkey cabbage roll skillet | Dinner | 2 | 520 | 36.3 g | 59.3 g | 16.8 g | $3.12 |
| Turkey spinach meatballs and pasta | Dinner | 2 | 580 | 46.9 g | 68.1 g | 17 g | $3.57 |
| Turkey sweet potato black bean pan | Dinner | 2 | 570 | 39.6 g | 68.5 g | 16.9 g | $3.06 |
| Turkey mushroom yogurt pasta | Dinner | 2 | 580 | 50.1 g | 60.4 g | 18.7 g | $3.49 |
| Turkey stuffed pepper bowls | Dinner | 2 | 580 | 38.1 g | 58.7 g | 22.7 g | $3.64 |
| Turkey pea cottage pie | Dinner | 2 | 600 | 41.5 g | 69.8 g | 18.4 g | $3.28 |
| Tofu broccoli soy rice bowls | Dinner | 2 | 460 | 27.2 g | 59.9 g | 13.8 g | $2.63 |
| Tofu chickpea tomato curry | Dinner | 2 | 530 | 29.7 g | 71.9 g | 15.1 g | $3.07 |
| Tofu edamame fried rice | Dinner | 2 | 560 | 33.7 g | 70 g | 17.1 g | $2.58 |
| Lentil tofu tomato ragu | Dinner | 2 | 580 | 35.6 g | 87.3 g | 12.8 g | $2.32 |
| Peanut tofu sweet potato stew | Dinner | 2 | 490 | 25.9 g | 55.3 g | 21.2 g | $2.88 |
| Tofu pepper tortilla skillet | Dinner | 2 | 560 | 31.8 g | 75.2 g | 16.4 g | $2.96 |
| Tofu edamame noodle soup | Dinner | 2 | 500 | 33.9 g | 62.2 g | 16.2 g | $2.55 |
| Lentil edamame tomato stew | Dinner | 2 | 530 | 36 g | 76.1 g | 12.2 g | $2.12 |
| Lentil and kidney bean chili rice | Dinner | 2 | 660 | 37 g | 116.8 g | 7.9 g | $2.38 |
| Lentil spinach cottage cheese bake | Dinner | 2 | 530 | 42.6 g | 63 g | 14.6 g | $2.48 |
| White bean tomato egg pan | Dinner | 2 | 520 | 38.7 g | 60.6 g | 15.3 g | $2.52 |
| Egg edamame fried rice | Dinner | 2 | 610 | 34.2 g | 70.4 g | 21.7 g | $2.07 |
| Cottage cheese bean pasta bake | Dinner | 2 | 670 | 45.6 g | 101.5 g | 13 g | $2.71 |
| Tuna tomato whole-wheat pasta | Dinner | 2 | 530 | 39.4 g | 81.4 g | 8.1 g | $2.55 |
| Tuna white bean potato bake | Dinner | 2 | 550 | 49.5 g | 72.2 g | 7.9 g | $2.89 |
| Canned salmon lentil tomato pan | Dinner | 2 | 430 | 43.7 g | 48.1 g | 9.7 g | $3.14 |
| Beef lentil kidney bean chili | Dinner | 2 | 560 | 43.5 g | 65.6 g | 15.1 g | $3.32 |
| Beef cabbage rice bowls | Dinner | 2 | 580 | 39.9 g | 60.9 g | 20.2 g | $3.26 |
| Beef white bean tomato pasta | Dinner | 2 | 670 | 44.5 g | 92.1 g | 16.1 g | $3.33 |
| Chicken mushroom brown rice bowls | Dinner | 2 | 530 | 52.1 g | 56.3 g | 10.5 g | $3.11 |
| Tofu lentil cauliflower curry | Dinner | 2 | 570 | 37.7 g | 77.1 g | 14.4 g | $3.09 |
| White bean pea cottage cheese mash | Dinner | 2 | 630 | 45.2 g | 96.7 g | 9 g | $2.73 |

## Reproduce an estimate

For each ingredient: multiply its nutrient value per 100 g by the grams per serving from the plan, then divide by 100. Add the ingredient results. Cost uses the same gram calculation with the dollar value per 100 g, plus the $0.03 pantry allowance. The ingredient data and plan quantities are included in the repository and the deployed static files; no external API key is required.

The collection tests check all 100 unrounded estimates against both criteria, unique IDs and ingredient combinations, serving math, safe cooking instructions, source URLs, and compatibility with library backups.
