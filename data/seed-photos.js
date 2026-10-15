const photo = (key, alt, author, slug) => ({ src: `/assets/${key}.jpg`, alt, author, sourceUrl: `https://unsplash.com/photos/${slug}`, license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', caption: 'Serving inspiration; the photographed dish may differ from this recipe.' });
export const seedPhotos = {
  oats: photo('oats', 'Oatmeal bowls with fruit toppings', 'Brooke Lark', 'two-bowls-of-oatmeal-with-fruits-W9OKrxBqiZA'),
  salmon: photo('salmon', 'Cooked salmon with colorful vegetables', 'alexanderafan', 'salmon-dish-with-colorful-vegetables-on-a-plate-z0l1MxpQAE8'),
  chickpea: photo('chickpea', 'A colorful vegetable and chickpea bowl', 'Anna Pelzer', 'bowl-of-vegetable-salads-IGfIGP5ONV0'),
  noodles: photo('noodles', 'Vegetable noodles in a white bowl', 'Sanjay Dosajh', 'delicious-vegetable-noodles-served-in-a-white-bowl-PxYofnvL6PI'),
  eggs: photo('eggs', 'Eggs served on toast', 'Ben Kolde', 'bread-with-sunny-side-up-egg-served-on-white-ceramic-plate-FFqNATH27EM'),
  soup: photo('soup', 'A bowl of orange vegetable soup', 'Cala', 'w6ftFbPCs9I'),
};
