/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [

    // Actor Sheet Partials
    "systems/sw5e/templates/actors/oldActor/parts/actor-traits.html",
    "systems/sw5e/templates/actors/oldActor/parts/actor-inventory.html",
    "systems/sw5e/templates/actors/oldActor/parts/actor-features.html",
    "systems/sw5e/templates/actors/oldActor/parts/actor-powerbook.html",
    "systems/sw5e/templates/actors/oldActor/parts/actor-effects.html",


    "systems/sw5e/templates/actors/newActor/parts/swalt-biography.html",
    "systems/sw5e/templates/actors/newActor/parts/swalt-core.html",
    "systems/sw5e/templates/actors/newActor/parts/swalt-features.html",
    "systems/sw5e/templates/actors/newActor/parts/swalt-inventory.html",
    "systems/sw5e/templates/actors/newActor/parts/swalt-notes.html",
    "systems/sw5e/templates/actors/newActor/parts/swalt-powerbook.html",
    "systems/sw5e/templates/actors/newActor/parts/swalt-resources.html",
    "systems/sw5e/templates/actors/newActor/parts/swalt-traits.html",
    
    // Item Sheet Partials
    "systems/sw5e/templates/items/parts/item-action.html",
    "systems/sw5e/templates/items/parts/item-activation.html",
    "systems/sw5e/templates/items/parts/item-description.html",
    "systems/sw5e/templates/items/parts/item-mountable.html"
  ];

  // Load the template parts
  return loadTemplates(templatePaths);
};
