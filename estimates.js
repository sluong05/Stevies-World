// Estimated per-serving nutrients and full-recipe ingredient costs.
// Source review: October 13, 2026. See ESTIMATES.md for calculations and assumptions.
export const recipeEstimates = {
  "berry-almond-oats": {
    "nutrition": {
      "calories": 320,
      "protein": 13,
      "carbs": 49,
      "fat": 9,
      "note": "Whole-recipe assumptions for 2 servings: 2% dairy milk, 1 cup blueberries (148 g), and 2 tbsp sliced almonds (11.5 g). Optional maple syrup is excluded. Soy milk or different berries change these values; all estimates are rounded.",
      "sources": [
        {
          "label": "USDA · Ingredient nutrient data",
          "url": "https://fdc.nal.usda.gov/download-datasets/"
        },
        {
          "label": "USDA · Rolled oats, 1 cup",
          "url": "https://fdc.nal.usda.gov/food-details/173904/nutrients"
        }
      ]
    },
    "cost": {
      "total": 3.17,
      "currency": "USD",
      "note": "US grocery budget estimate for ingredients used, with 2% milk and fresh blueberries; optional maple syrup excluded. Based on representative online prices checked October 13, 2026, plus small pantry allowances. Prices vary by store and season; full-package checkout cost will be higher.",
      "sources": [
        {
          "label": "Walmart · Oat prices",
          "url": "https://www.walmart.com/c/best-sellers/old-fashioned-oats-great-value"
        },
        {
          "label": "Walmart · Milk prices",
          "url": "https://www.walmart.com/c/best-sellers/great-value-2-milk-gallon"
        },
        {
          "label": "Walmart · Blueberry prices",
          "url": "https://www.walmart.com/browse/fresh-fruits/blueberries/976759_976793_9756351_9015203"
        }
      ]
    }
  },
  "lemon-salmon-bowl": {
    "nutrition": {
      "calories": 620,
      "protein": 39,
      "carbs": 51,
      "fat": 29,
      "note": "Whole-recipe assumptions for 2 servings: two 5 oz raw farmed Atlantic salmon fillets, 273 g broccoli, plain cooked brown rice (303 g total), whole-milk yogurt, and parsley. All oil and juice from half a lemon are included; uneaten lemon wedges are excluded. Fish type and ready-rice brands can change values.",
      "sources": [
        {
          "label": "USDA · Ingredient nutrient data",
          "url": "https://fdc.nal.usda.gov/download-datasets/"
        },
        {
          "label": "USDA · Raw farmed Atlantic salmon, 10 oz",
          "url": "https://fdc.nal.usda.gov/food-details/175167/nutrients"
        }
      ]
    },
    "cost": {
      "total": 11.32,
      "currency": "USD",
      "note": "US grocery budget estimate for portions used, including 10 oz salmon at $10.64/lb, ready-to-heat rice, and one lemon. Online price examples checked October 13, 2026; other pantry and produce costs are stated budget assumptions. Excludes tax, delivery, and cooking energy; local prices vary.",
      "sources": [
        {
          "label": "Walmart · Salmon prices",
          "url": "https://www.walmart.com/c/kp/salmon-del-atlantico"
        },
        {
          "label": "Walmart · Broccoli prices",
          "url": "https://www.walmart.com/c/kp/fresh-broccoli"
        },
        {
          "label": "Walmart · Ready-to-heat rice",
          "url": "https://www.walmart.com/browse/food/brown-rice/great-value/976759_976794_4879140_8850682_3061251/YnJhbmQ6R3JlYXQgVmFsdWUie"
        }
      ]
    }
  },
  "chickpea-cucumber-pitas": {
    "nutrition": {
      "calories": 400,
      "protein": 13,
      "carbs": 45,
      "fat": 21,
      "note": "Whole-recipe assumptions for 2 servings: 254 g drained and rinsed chickpeas, half a 301 g cucumber, a medium avocado with 150 g edible flesh, and four large lettuce leaves (96 g). Optional pita and suggested rice are excluded from both macros and cost.",
      "sources": [
        {
          "label": "USDA · Ingredient nutrient data",
          "url": "https://fdc.nal.usda.gov/download-datasets/"
        },
        {
          "label": "USDA · Drained, rinsed chickpeas, one can",
          "url": "https://fdc.nal.usda.gov/food-details/173801/nutrients"
        }
      ]
    },
    "cost": {
      "total": 5.44,
      "currency": "USD",
      "note": "US grocery budget estimate for ingredients used, including a 15 oz chickpea can and medium avocado; optional pita and rice excluded. Chickpea and tomato price examples checked October 13, 2026; remaining items use stated budget assumptions. Full-package purchases cost more and local prices vary.",
      "sources": [
        {
          "label": "Walmart · Chickpea prices",
          "url": "https://www.walmart.com/c/kp/chick-peas-can"
        },
        {
          "label": "Walmart · Cherry tomato prices",
          "url": "https://www.walmart.com/c/kp/cherry-tomatoes-fresh-produce"
        }
      ]
    }
  },
  "sesame-ginger-noodles": {
    "nutrition": {
      "calories": 510,
      "protein": 23,
      "carbs": 68,
      "fat": 19,
      "note": "Whole-recipe assumptions for 2 servings: 5 oz dry whole-wheat pasta, 8 oz regular firm tofu (USDA Azumaya entry), a medium pepper (119 g), a medium carrot (61 g), and 140 g cabbage. All sauce and oil are counted. Optional sesame seeds are excluded. Tofu brands can vary substantially.",
      "sources": [
        {
          "label": "USDA · Ingredient nutrient data",
          "url": "https://fdc.nal.usda.gov/download-datasets/"
        },
        {
          "label": "USDA · Firm tofu",
          "url": "https://fdc.nal.usda.gov/food-details/175236/nutrients"
        }
      ]
    },
    "cost": {
      "total": 4.07,
      "currency": "USD",
      "note": "US grocery budget estimate for the quantities used, with $1.74/lb pasta and $2.22/lb firm tofu examples checked October 13, 2026. Vegetables, sauces, and oils use stated budget assumptions. Optional sesame seeds excluded; full-package checkout prices and local costs will differ.",
      "sources": [
        {
          "label": "Walmart · Whole-wheat pasta price",
          "url": "https://www.walmart.com/ip/1796052306"
        },
        {
          "label": "Walmart · Firm tofu prices",
          "url": "https://www.walmart.com/c/kp/firm-tofu"
        }
      ]
    }
  },
  "spinach-eggs-toast": {
    "nutrition": {
      "calories": 320,
      "protein": 20,
      "carbs": 25,
      "fat": 16,
      "note": "Per serving, using two large eggs, one 45 g slice of whole-grain bread (whole-wheat nutrient proxy), 40 g packed spinach, and parsley. All oil is included. Optional side fruit or beans are excluded; slice size and bread brand change the estimate.",
      "sources": [
        {
          "label": "USDA · Ingredient nutrient data",
          "url": "https://fdc.nal.usda.gov/download-datasets/"
        },
        {
          "label": "USDA · Large eggs, 4, edible portion",
          "url": "https://fdc.nal.usda.gov/food-details/171287/nutrients"
        }
      ]
    },
    "cost": {
      "total": 3.53,
      "currency": "USD",
      "note": "US grocery budget estimate for portions used, including four eggs from a $1.67 dozen price example and 90 g bread. Egg and tomato prices checked October 13, 2026; bread, spinach, oil, and herbs use stated budget assumptions. Egg prices vary widely; full-package checkout cost is higher.",
      "sources": [
        {
          "label": "Walmart · Egg prices",
          "url": "https://www.walmart.com/c/kp/great-value-large-eggs"
        },
        {
          "label": "Walmart · Cherry tomato prices",
          "url": "https://www.walmart.com/c/kp/cherry-tomatoes-fresh-produce"
        }
      ]
    }
  },
  "tomato-lentil-soup": {
    "nutrition": {
      "calories": 280,
      "protein": 15,
      "carbs": 48,
      "fat": 5,
      "note": "Whole-recipe assumptions for 4 servings: 192 g dry red lentils (generic dry lentil nutrient proxy), a 14.5 oz tomato can, 80 g packed spinach, and Pacific low-sodium vegetable broth. Bread suggested for serving is excluded. Water added while cooking changes volume, not the recipe total.",
      "sources": [
        {
          "label": "USDA · Ingredient nutrient data",
          "url": "https://fdc.nal.usda.gov/download-datasets/"
        },
        {
          "label": "Pacific Foods · Broth nutrition label",
          "url": "https://www.pacificfoods.com/products/pacific-foods/organic-low-sodium-vegetable-broth/"
        }
      ]
    },
    "cost": {
      "total": 7.06,
      "currency": "USD",
      "note": "US grocery budget estimate for ingredients used, including $2.18/lb red lentils and a $3.43 low-sodium broth carton from examples checked October 13, 2026. Produce and pantry items use stated assumptions. Serving bread is excluded; full-package checkout cost and local prices vary.",
      "sources": [
        {
          "label": "Walmart · Red lentil price",
          "url": "https://www.walmart.com/ip/876645227"
        },
        {
          "label": "Walmart · Low-sodium broth prices",
          "url": "https://www.walmart.com/c/kp/vegetable-broth-low-sodium"
        }
      ]
    }
  }
};
