/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your module, or remove it.
 * Author: [your name]
 * Content License: [copyright and-or license] If using an existing system
 * 					you may want to put a (link to a) license or copyright
 * 					notice here (e.g. the OGL).
 * Software License: [your license] Put your desired license here, which
 * 					 determines how others may use and modify your module
 */
// Import TypeScript modules
import { registerSettings } from './module/settings.js';
import { preloadTemplates } from "./module/preloadTemplates.js";
import { dynamiceffectsSetupActions, doEffects, dynamiceffectsInitActions } from "./module/dynamiceffects.js";
import { dynamiceffectsReadyActions } from "./module/dynamiceffects.js";
import { dynamiceffectsShowEffects, activateItem, removeActiveEffectsToken, dynamiceffectsTogglePassiveEffect, dynamiceffectsSetPassiveEffect, toggleActorIdEffect, applyActive, setTokenVisibility, blindToken, restoreVision, setTileVisibility, moveToken, renameToken, getEffects, effectsActor } from "./module/dynamiceffectsMacros.js";
import { teleportToToken } from "./module/dynamiceffectsMacros.js";
import { getItemActiveEffects } from "./module/dynamiceffects.js";
import { initSheetTab } from "./module/dynamicEffectsTab.js";
import { ModSpec } from "./module/dynamiceffects.js";
import { ItemEffectSelector } from "./module/apps/dynamiceffectsSelector.js";
import { migrateItems, migrateActors, migrateAll, migrateAllAts, fixAbilities } from "./module/migration.js";
import { GMAction, requestGMAction, GMActionMessage } from "./module/GMAction.js";
import { convertToTrinket } from './module/utils.js';
/* ------------------------------------ */
/* Initialize module					*/
/* ------------------------------------ */
Hooks.once('init', async function () {
    // Register custom module settings
    registerSettings();
    console.log('dynamiceffects | Initializing dynamiceffects');
    dynamiceffectsInitActions();
    ItemEffectSelector.initActions();
    // Assign custom classes and constants here
    // Preload Handlebars templates
    await preloadTemplates();
    // Register custom sheets (if any)
});
/* ------------------------------------ */
/* Setup module							*/
/* ------------------------------------ */
Hooks.once('setup', function () {
    // Do anything after initialization but before
    // ready
    GMAction.initActions;
    dynamiceffectsSetupActions();
    ItemEffectSelector.setupActions();
    //@ts-ignore
    window.allSpecs = ModSpec.allSpecs;
    //@ts-ignore
    window.allSpecsObj = ModSpec.allSpecsObj;
    //@ts-ignore
    window.DynamicEffects = {
        _ModSpec: ModSpec,
        effects: dynamiceffectsShowEffects,
        effectsToken: effectsActor,
        togglePassive: dynamiceffectsTogglePassiveEffect,
        setPassive: dynamiceffectsSetPassiveEffect,
        getItemActiveEffects: getItemActiveEffects,
        removeAllActiveffects: removeActiveEffectsToken,
        _toggleActorIdEffect: toggleActorIdEffect,
        applyActive: applyActive,
        activateItem: activateItem,
        getEffects: getEffects,
        doEffects: doEffects,
        GMAction: GMAction,
        requestGMAction: requestGMAction,
        GMActionMessage: GMActionMessage,
        migrateItems: migrateItems,
        migrateActors: migrateActors,
        migrateAll: migrateAll,
        migrateAllAts: migrateAllAts,
        fixAbilities: fixAbilities,
        teleportToToken: teleportToToken,
        blindToken: blindToken,
        restoreVision: restoreVision,
        setTokenVisibility: setTokenVisibility,
        setTileVisibility: setTileVisibility,
        moveToken: moveToken,
        renameToken: renameToken,
    };
});
/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', function () {
    initSheetTab();
    GMAction.readyActions();
    dynamiceffectsReadyActions();
    ItemEffectSelector.readyActions();
    Hooks.on("getItemDirectoryEntryContext", (html, list) => {
        list.push({
            name: "Convert Loot to Trinket",
            icon: "<i class='fas fa-file-import'></i>",
            callback: html => {
                let item = game.items.get(html.attr("data-entity-id"));
                convertToTrinket(item);
            }
        });
    });
    // macroReadySetup();
});
// Add any additional hooks if necessary
