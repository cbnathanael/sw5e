/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @return {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function() {
  ui.notifications.info(`Applying SW5E System Migration for version ${game.system.data.version}. Please be patient and do not close your game or shut down your server.`, {permanent: true});

  // Migrate World Actors
  for ( let a of game.actors.entities ) {
    try {
      const updateData = migrateActorData(a.data);
      if ( !isObjectEmpty(updateData) ) {
        console.log(`Migrating Actor entity ${a.name}`);
        await a.update(updateData, {enforceTypes: false});
      }
    } catch(err) {
      console.error(err);
    }
  }

  // Migrate World Items
  for ( let i of game.items.entities ) {
    try {
      const updateData = migrateItemData(i.data);
      if ( !isObjectEmpty(updateData) ) {
        console.log(`Migrating Item entity ${i.name}`);
        await i.update(updateData, {enforceTypes: false});
      }
    } catch(err) {
      console.error(err);
    }
  }

  // Migrate Actor Override Tokens
  for ( let s of game.scenes.entities ) {
    try {
      const updateData = migrateSceneData(s.data);
      if ( !isObjectEmpty(updateData) ) {
        console.log(`Migrating Scene entity ${s.name}`);
        await s.update(updateData, {enforceTypes: false});
      }
    } catch(err) {
      console.error(err);
    }
  }

  // Migrate World Compendium Packs
  const packs = game.packs.filter(p => {
    return (p.metadata.package === "world") && ["Actor", "Item", "Scene"].includes(p.metadata.entity)
  });
  for ( let p of packs ) {
    await migrateCompendium(p);
  }

  // Set the migration as complete
  game.settings.set("sw5e", "systemMigrationVersion", game.system.data.version);
  ui.notifications.info(`SW5E System Migration to version ${game.system.data.version} completed!`, {permanent: true});
};

/* -------------------------------------------- */

/**
 * Apply migration rules to all Entities within a single Compendium pack
 * @param pack
 * @return {Promise}
 */
export const migrateCompendium = async function(pack) {
  const entity = pack.metadata.entity;
  if ( !["Actor", "Item", "Scene"].includes(entity) ) return;

  // Begin by requesting server-side data model migration and get the migrated content
  await pack.migrate();
  const content = await pack.getContent();

  // Iterate over compendium entries - applying fine-tuned migration functions
  for ( let ent of content ) {
    try {
      let updateData = null;
      if (entity === "Item") updateData = migrateItemData(ent.data);
      else if (entity === "Actor") updateData = migrateActorData(ent.data);
      else if ( entity === "Scene" ) updateData = migrateSceneData(ent.data);
      if (!isObjectEmpty(updateData)) {
        expandObject(updateData);
        updateData["_id"] = ent._id;
        await pack.updateEntity(updateData);
        console.log(`Migrated ${entity} entity ${ent.name} in Compendium ${pack.collection}`);
      }
    } catch(err) {
      console.error(err);
    }
  }
  console.log(`Migrated all ${entity} entities from Compendium ${pack.collection}`);
};

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate a single Actor entity to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {Actor} actor   The actor to Update
 * @return {Object}       The updateData to apply
 */
export const migrateActorData = function(actor) {
  const updateData = {};

  // Actor Data Updates
  _migrateActorBonuses(actor, updateData);

  // Remove deprecated fields
  _migrateRemoveDeprecated(actor, updateData);

  // Migrate Owned Items
  if ( !actor.items ) return updateData;
  let hasItemUpdates = false;
  const items = actor.items.map(i => {

    // Migrate the Owned Item
    let itemUpdate = migrateItemData(i);

    // Prepared, Equipped, and Proficient for NPC actors
    if ( actor.type === "npc" ) {
      if (getProperty(i.data, "preparation.prepared") === false) itemUpdate["data.preparation.prepared"] = true;
      if (getProperty(i.data, "equipped") === false) itemUpdate["data.equipped"] = true;
      if (getProperty(i.data, "proficient") === false) itemUpdate["data.proficient"] = true;
    }

    // Update the Owned Item
    if ( !isObjectEmpty(itemUpdate) ) {
      hasItemUpdates = true;
      return mergeObject(i, itemUpdate, {enforceTypes: false, inplace: false});
    } else return i;
  });
  if ( hasItemUpdates ) updateData.items = items;
  return updateData;
};

/* -------------------------------------------- */

/**
 * Migrate a single Item entity to incorporate latest data model changes
 * @param item
 */
export const migrateItemData = function(item) {
  const updateData = {};

  // Remove deprecated fields
  _migrateRemoveDeprecated(item, updateData);

  // Return the migrated update data
  return updateData;
};

/* -------------------------------------------- */

/**
 * Migrate a single Scene entity to incorporate changes to the data model of it's actor data overrides
 * Return an Object of updateData to be applied
 * @param {Object} scene  The Scene data to Update
 * @return {Object}       The updateData to apply
 */
export const migrateSceneData = function(scene) {
  const tokens = duplicate(scene.tokens);
  return {
    tokens: tokens.map(t => {
      if (!t.actorId || t.actorLink || !t.actorData.data) {
        t.actorData = {};
        return t;
      }
      const token = new Token(t);
      if ( !token.actor ) {
        t.actorId = null;
        t.actorData = {};
      } else if ( !t.actorLink ) {
        const updateData = migrateActorData(token.data.actorData);
        t.actorData = mergeObject(token.data.actorData, updateData);
      }
      return t;
    })
  };
};

/* -------------------------------------------- */
/*  Low level migration utilities
/* -------------------------------------------- */

/**
 * Migrate the actor bonuses object
 * @private
 */
function _migrateActorBonuses(actor, updateData) {
  const b = game.system.model.Actor.character.bonuses;
  for ( let k of Object.keys(actor.data.bonuses || {}) ) {
    if ( k in b ) updateData[`data.bonuses.${k}`] = b[k];
    else updateData[`data.bonuses.-=${k}`] = null;
  }
}


/* -------------------------------------------- */


/**
 * A general migration to remove all fields from the data model which are flagged with a _deprecated tag
 * @private
 */
const _migrateRemoveDeprecated = function(ent, updateData) {
  const flat = flattenObject(ent.data);

  // Identify objects to deprecate
  const toDeprecate = Object.entries(flat).filter(e => e[0].endsWith("_deprecated") && (e[1] === true)).map(e => {
    let parent = e[0].split(".");
    parent.pop();
    return parent.join(".");
  });

  // Remove them
  for ( let k of toDeprecate ) {
    let parts = k.split(".");
    parts[parts.length-1] = "-=" + parts[parts.length-1];
    updateData[`data.${parts.join(".")}`] = null;
  }
};
import { ItemEffect, ModSpec } from "./dynamiceffects.js";
var debug;
export async function migrateItems(saveItem = false, itemName = "", deleteOldEffects = false, _debug = false) {
    debug = _debug;
    let items = game.items.entities;
    items.forEach(async (item) => {
        if (itemName === "" || item.name === itemName) {
            console.log("Migrating Item", item.name);
            let itemData = duplicate(item.data);
            if (hasProperty(item.data.flags, "dynamicitems.effects.value")) {
                if (debug)
                    console.log(`${item.name} has effects`, item.data.flags.dynamicitems);
                let newEffects = convertEffects(item.data.flags.dynamicitems.effects.value, item);
                if (debug)
                    console.log(`For Item ${item.name} ${item.id} new effects are`, newEffects);
                if (newEffects.length > 0) {
                    itemData.flags.dynamiceffects = {};
                    itemData.flags.dynamiceffects.effects = newEffects;
                    itemData.flags.dynamiceffects.alwaysActive = getProperty(item.data.flags.dynamicitems, "cursed.value") || false;
                    itemData.flags.dynamiceffects.equipActive = getProperty(item.data.flags.dynamicitems, "active.value") || false;
                }
            }
            if (deleteOldEffects) {
                delete itemData.flags.dynamicitems;
                if (getProperty(itemData.flags, "core.sheetClass") === "sw5e.DynamicItemSheet5e") {
                    itemData.flags.core.sheetClass = "sw5e.ItemSheet5e";
                }
            }
            if (saveItem)
                await item.update({ "flags": itemData.flags }, {});
            if (deleteOldEffects)
                await item.update({ "flags.-=dynamicitems": null }, {});
            item.data.flags = itemData.flags;
        }
    });
}
function convertEffects(oldEffects, item) {
    let fixedEffects = [];
    let counter = 0;
    oldEffects.forEach(oe => {
        if (obsoleteEffects[oe.effect]) {
            console.warn(`Detected obsolete effect ${oe.effect} replacing wtih ${obsoleteEffects[oe.effect]}`);
            oe.effect = obsoleteEffects[oe.effect];
        }
        if (!ModSpec.allSpecsObj[oe.effect]) {
            console.warn(`Invalid modification specification ${oe.effect} for item ${item.name} ${item.id} - effect skipped`);
        }
        else {
            if (typeof oe.value === "string")
                while (oe.value.startsWith("+"))
                    oe.value = oe.value.slice(1);
            oe.value = oe.value.replace(/@data./g, "@");
            fixedEffects.push(new ItemEffect(counter, item.id, oe.effect, oe.mode, oe.value));
        }
        counter += 1;
    });
    return fixedEffects;
}
export async function migrateActors(saveActor = false, actorName = "", deleteOldEffects = true, _debug = false) {
    debug = _debug;
    game.actors.entities.forEach(async (a) => {
        if (actorName === "" || actorName === a.name) {
            console.log("Migrating Actor", a.name);
            //@ts-ignore
            let newItems = duplicate(a.data.items);
            if (debug)
                console.log("Old items are ", newItems);
            newItems = newItems.map(itemData => {
                if (debug)
                    console.log("migrating item ", itemData);
                if (hasProperty(itemData.flags, "dynamicitems")) {
                    itemData.flags.dynamiceffects = {};
                    itemData.flags.dynamiceffects.effects = convertEffects(getProperty(itemData.flags.dynamicitems, "effects.value") || [], itemData);
                    itemData.flags.dynamiceffects.alwaysActive = getProperty(itemData.flags.dynamicitems, "cursed.value") || false;
                    itemData.flags.dynamiceffects.equipActive = getProperty(itemData.flags.dynamicitems, "active.value") || false;
                }
                if (deleteOldEffects)
                    delete itemData.flags.dynamicitems;
                return itemData;
            });
            if (saveActor) {
                await a.update({ "items": [] });
                await a.update({ "items": newItems });
            }
            //@ts-ignore
            else
                a.data.items = newItems;
            //@ts-ignore
            a.prepareEmbeddedEntities();
            a.prepareData();
            if (debug)
                console.log(`For actor ${a.name} new items are `, newItems);
        }
    });
}
export async function migrateAll(saveData = false, _debug = false) {
    debug = _debug;
    await migrateItems(saveData, "", true, debug);
    await migrateActors(saveData, "", true, debug);
}
export async function migrateActorsAts(saveActor = false, actorName = "", deleteOldEffects = true, _debug = false) {
    debug = _debug;
    game.actors.entities.forEach(async (a) => {
        if (actorName === "" || actorName === a.name) {
            console.log("Migrating Actor", a.name);
            //@ts-ignore
            let newItems = duplicate(a.data.items);
            if (debug)
                console.log("Old items are ", newItems);
            newItems = newItems.map(itemData => {
                if (debug)
                    console.log("migrating item ", itemData);
                if (hasProperty(itemData.flags, "dynamiceffects")) {
                    itemData.flags.dynamiceffects.effects = convertEffectsAt(getProperty(itemData.flags.dynamiceffects, "effects") || []);
                }
                return itemData;
            });
            if (saveActor) {
                await a.update({ "items": [] });
                await a.update({ "items": newItems });
            }
            //@ts-ignore
            else
                a.data.items = newItems;
            //@ts-ignore
            a.prepareEmbeddedEntities();
            a.prepareData();
            if (debug)
                console.log(`For actor ${a.name} new items are `, newItems);
        }
    });
}
export async function migrateItemsAts(saveItem = false, itemName = "", deleteOldEffects = false, _debug = false) {
    debug = _debug;
    let items = game.items.entities;
    items.forEach(async (item) => {
        if (itemName === "" || item.name === itemName) {
            console.log("Migrating Item", item.name);
            let itemData = duplicate(item.data);
            if (hasProperty(item.data.flags, "dynamiceffects.effects")) {
                if (debug)
                    console.log(`${item.name} has effects`, item.data.flags.dynamiceffects);
                let newEffects = convertEffectsAt(item.data.flags.dynamiceffects.effects);
                if (debug)
                    console.log(`For Item ${item.name} ${item.id} new effects are`, newEffects);
                if (newEffects.length > 0) {
                    itemData.flags.dynamiceffects.effects = newEffects;
                }
            }
            if (saveItem)
                await item.update({ "flags": itemData.flags }, {});
            item.data.flags = itemData.flags;
        }
    });
}
function convertEffectsAt(oldEffects) {
    oldEffects = oldEffects.map(oe => {
        oe.value = oe.value.replace(/@data./g, "@");
        return oe;
    });
    return oldEffects;
}
export async function migrateAllAts(saveData = false, _debug = false) {
    debug = _debug;
    await migrateItemsAts(saveData, "", true, debug);
    await migrateActorsAts(saveData, "", true, debug);
}
export async function fixAbilities() {
    let abilityKeys = Object.keys(CONFIG.SW5E.abilities);
    game.actors.entities.forEach(a => {
        Object.keys(a.data.data.skills).forEach(async (sname) => {
            let s = a.data.data.skills[sname];
            if (!abilityKeys.includes(s.ability)) {
                let update = {};
                update[`data.skills.${sname}.ability`] = game.system.model.Actor.character.skills[sname].ability;
                console.log("Actor ", a.name, " skill ", sname, " is broken");
                console.log("Fixed is ", await a.update(update));
            }
        });
    });
}
let obsoleteEffects = {
    "data.bonuses.mwak": "data.bonuses.mwak.attack",
    "data.bonuses.rwak": "data.bonuses.rwak.attack",
    "data.bonuses.mpak": "data.bonuses.mpak.attack",
    "data.bonuses.rpak": "data.bonuses.rpak.attack",
    "data.bonuses.damage": "data.bonuses.mwak.damage",
    "data.bonuses.abilitySave": "data.bonuses.abilities.save",
    "data.bonuses.abilityCheck": "data.bonuses.abilities.check",
    "data.bonuses.skillCheck": "data.bonuses.abilities.skill",
    "data.bonuses.skills.check": "data.bonuses.abilities.skill",
    "flags.sw5e.powerDCBonus": "data.bonuses.power.dc"
};
