import { ItemEffectSelector } from "./apps/dynamiceffectsSelector.js";
import { ModSpec, playersCanSeeEffects } from "./dynamiceffects.js";
let debugLog = false;
var makeActive = false;
export function initSheetTab() {
    let itemSheets = {};
    Object.values(CONFIG.Item.sheetClasses).forEach(itemType => Object.keys(itemType).forEach(sheetName => itemSheets[sheetName] = 1));
    Object.keys(itemSheets).forEach(sheetName => Hooks.on(`render${sheetName.split(".")[1]}`, (app, html, data) => {
        addDynamicEffectsTab(app, html, data);
    }));
}
async function addDynamicEffectsTab(app, html, data) {
    if (playersCanSeeEffects === "none" && !game.user.isGM)
        return;
    let item = app.object;
    // if (["power", "backpack"].includes(item.type)) return;
    if (["loot"].includes(item.type))
        return;
    // if (!game.user.isGM && !(item.data.data.attuned || item.data.data.identified)) return;
    if (!hasProperty(item.data, "flags.dynamiceffects.equipActive"))
        setProperty(item.data, "flags.dynamiceffects.equipActive", false);
    if (!hasProperty(item.data, "flags.dynamiceffects.alwaysActive"))
        setProperty(item.data, "flags.dynamiceffects.alwaysActive", false);
    if (!hasProperty(item.data, "flags.dynamiceffects.effects"))
        setProperty(item.data, "flags.dynamiceffects.effects", []);
    //  let tabSelector = html.find(`.sheet-navigation`),
    let tabSelector = html.find(`.tabs`), settingsContainer = html.find(`.sheet-body`), dynamiceffectsTabString = `<a class="item" data-tab="dynamiceffects">${game.i18n.localize("dynamiceffects.Title")}</a>`, tab = tabSelector.append($(dynamiceffectsTabString));
    // pf1
    if (settingsContainer.length === 0)
        settingsContainer = html.find(`.primary-body`);
    let dynamiceffectsTabTemplate = await renderTemplate("./modules/dynamiceffects/templates/dynamiceffects-tab.html", {
        flags: item.data.flags,
        actives: item.data.flags.dynamiceffects.effects.filter(ie => ie.active).map(ie => { ie.label = ModSpec.allSpecsObj[ie.modSpecKey] ? ModSpec.allSpecsObj[ie.modSpecKey].label : "invalid"; return ie; }),
        passives: item.data.flags.dynamiceffects.effects.filter(ie => !ie.active).map(ie => { ie.label = ModSpec.allSpecsObj[ie.modSpecKey] ? ModSpec.allSpecsObj[ie.modSpecKey].label : ""; return ie; }),
        isGM: game.user.isGM,
        //@ts-ignore
        canEdit: game.user.isGM || (playersCanSeeEffects === "edit" && game.user.isTrusted),
        showEffects: playersCanSeeEffects !== "none" || game.user.isGM,
        data: { attuned: getProperty(item.data, "data.attuned") },
        needsAttuned: ["tool"].includes(item.type)
    });
    let extraTab = settingsContainer.append(dynamiceffectsTabTemplate);
    if (makeActive && app._tabs[0])
        app._tabs[0].activate("dynamiceffects");
    makeActive = false;
    html.find('.dynamiceffects .effect-create').click(ev => {
        let effects = item.data.flags.dynamiceffects.effects || [];
        let newId = effects.length ? Math.max(...effects.map(i => Number(i.id))) + 1 : 1;
        new ItemEffectSelector(item, { id: `${newId}` }).render(true);
        makeActive = true;
    });
    // Update Effect Item
    html.find('.dynamiceffects .effect-edit').click(ev => {
        let effectId = Number($(ev.currentTarget).parents(".effect").attr("effect-id"));
        //@ts-ignore
        new ItemEffectSelector(item, { id: effectId }).render(true);
        makeActive = true;
    });
    // intercept Input Click and set Tab
    html.find('.dynamiceffects input[type="checkbox"]').click(ev => {
        makeActive = true;
    });
    // Delete Effect
    html.find('.dynamiceffects .effect-delete').click(async (ev) => {
        let li = $(ev.currentTarget).parents(".effect");
        let effectId = Number(li.attr("effect-id"));
        let effects = duplicate(item.data.flags.dynamiceffects.effects) || [];
        for (let i = 0; i < effects.length; i++) {
            if (effects[i].id === effectId) {
                effects.splice(i, 1);
            }
        }
        li.slideUp(200);
        if (item.isOwned) {
            await item.actor.updateOwnedItem({ "_id": item._id, "flags.dynamiceffects.effects": effects });
        }
        else
            await item.update({ "flags.dynamiceffects.effects": effects });
        makeActive = true;
    });
}
