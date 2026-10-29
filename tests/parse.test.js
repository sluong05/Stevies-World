import test from 'node:test';
import assert from 'node:assert/strict';
import { parseText, parseExerciseLine, parseWorkoutBlocks, formatWorkoutBlocks, detectType, parseMinutes, parseNutrition, extractHashtags, cleanTitle } from '../shared/parse.js';

const tiktokRecipe = `High protein chicken burrito bowls 🌯🔥 only 450 calories! #mealprep #highprotein #fyp #recipe
Ingredients:
- 500g chicken breast
- 1 cup rice
- 1 tbsp olive oil
- salt and pepper
For the sauce:
- 200g greek yogurt
- juice of 1 lime
Instructions:
1. Season the chicken with chili powder, salt and pepper.
2. Cook in a pan with olive oil for 6-7 minutes per side.
3. Assemble bowls with rice, chicken, salsa and sauce.
Macros per serving: 450 cals, 45g protein, 40g carbs, 10g fat
Serves 4`;

const igWorkout = `GLUTE DAY 🍑 save this for your next leg day!
Warm up:
Hip thrusts 3x12
Glute bridges x15
Workout:
1. Barbell hip thrust 4 x 8-10 rest 90s
2. Bulgarian split squats 3 sets of 10 each leg
3. RDL 3x12 (slow eccentric)
4. Cable kickbacks - 3 x 15 per side
5. Plank 3 x 45 sec
#gymtok #glutes #legday`;

test('a recipe caption becomes ingredients, steps, servings and macros', () => {
  const d = parseText(tiktokRecipe);
  assert.equal(d.type, 'recipe');
  assert.equal(d.title, 'High protein chicken burrito bowls only 450 calories');
  assert.deepEqual(d.ingredients, ['500g chicken breast', '1 cup rice', '1 tbsp olive oil', 'salt and pepper', 'For the sauce:', '200g greek yogurt', 'juice of 1 lime']);
  assert.equal(d.steps.length, 3);
  assert.equal(d.steps[0], 'Season the chicken with chili powder, salt and pepper.');
  assert.equal(d.servings, 4);
  assert.deepEqual(d.nutrition, { calories: 450, protein: 45, carbs: 40, fat: 10 });
  assert.equal(d.minutes, null, 'step timings are not the total time');
  assert.deepEqual(d.tags, ['mealprep', 'highprotein']);
});

test('a workout caption becomes sections of exercises with sets, reps and rest', () => {
  const d = parseText(igWorkout);
  assert.equal(d.type, 'workout');
  assert.equal(d.title, 'Glute Day');
  assert.deepEqual(d.blocks.map(b => b.name), ['Warm up', 'Workout']);
  assert.deepEqual(d.blocks[1].exercises[0], { name: 'Barbell hip thrust', sets: '4', reps: '8-10', rest: '90s', note: '' });
  assert.equal(d.blocks[1].exercises[1].reps, '10 each leg');
  assert.equal(d.blocks[1].exercises[2].note, 'slow eccentric');
  assert.equal(d.blocks[1].exercises[4].name, 'Plank');
  assert.equal(d.blocks[1].exercises[4].reps, '45s');
  assert.equal(d.focus, 'Lower body');
  assert.match(d.equipment, /Barbell/);
});

test('inline ingredient lists and plain notes are understood', () => {
  const pasta = parseText('Easy pasta 🍝\nIngredients: 200g spaghetti, 2 cloves garlic, 3 tbsp olive oil, chili flakes\nBoil pasta. Meanwhile, fry garlic in oil then toss with pasta. Ready in 15 minutes');
  assert.equal(pasta.type, 'recipe');
  assert.equal(pasta.ingredients.length, 4);
  assert.equal(pasta.minutes, 15);
  const note = parseText('Best running shoes I have tried\nNike Pegasus for daily runs\nHoka Clifton for long ones');
  assert.equal(note.type, 'note');
  assert.equal(note.title, 'Best running shoes I have tried');
  assert.match(note.body, /Hoka/);
});

test('a forced type wins over detection', () => {
  assert.equal(parseText(igWorkout, { type: 'note' }).type, 'note');
  assert.equal(detectType(igWorkout), 'workout');
  assert.equal(detectType(tiktokRecipe), 'recipe');
});

test('exercise lines in many common formats', () => {
  const cases = {
    'Goblet squat 3x10 rest 60s (pause at bottom)': { name: 'Goblet squat', sets: '3', reps: '10', rest: '60s', note: 'pause at bottom' },
    '3 sets x 12 reps - Lat pulldown': { name: 'Lat pulldown', sets: '3', reps: '12', rest: '', note: '' },
    'Push-ups: 4 x 15': { name: 'Push-ups', sets: '4', reps: '15', rest: '', note: '' },
    'Run 20 min': { name: 'Run', sets: '', reps: '20 min', rest: '', note: '' },
    'Walking lunges 3x20 steps': { name: 'Walking lunges', sets: '3', reps: '20 steps', rest: '', note: '' },
    '12 reps incline DB press x 3 sets': { name: 'Incline DB press', sets: '3', reps: '12', rest: '', note: '' },
    '• Face pulls 3×15 rest 1 min': { name: 'Face pulls', sets: '3', reps: '15', rest: '1 min', note: '' },
  };
  for (const [line, expected] of Object.entries(cases)) assert.deepEqual(parseExerciseLine(line), expected, line);
});

test('the workout editor text survives a round trip', () => {
  const blocks = parseWorkoutBlocks('Warm-up:\nBike 5 min\n\nMain:\nSquat 5x5 rest 2 min\nBench 3x8 (pause)\nGlute bridges x15');
  assert.deepEqual(parseWorkoutBlocks(formatWorkoutBlocks(blocks)), blocks);
});

test('small helpers', () => {
  assert.equal(parseMinutes('Prep: 10 min, Cook: 25 min'), 35);
  assert.equal(parseMinutes('Total time: 1 hr 15 min'), 75);
  assert.equal(parseMinutes('cook 6 minutes per side'), null);
  assert.equal(parseNutrition('nothing here'), null);
  assert.deepEqual(parseNutrition('Protein bowl 520 kcal | P 42g C 50g F 14g'), { calories: 520, protein: 42, carbs: 50, fat: 14 });
  assert.deepEqual(extractHashtags('#fyp #MealPrep #high_protein #viral'), ['Meal Prep', 'high protein']);
  assert.equal(cleanTitle('EASY HIGH PROTEIN PASTA (comment PASTA for the recipe)'), 'Easy High Protein Pasta');
  assert.equal(cleanTitle('Upper body workout - follow for more'), 'Upper body workout');
});
