import { mergeObjectPlusLookup, doLookups } from "./utils.js";
import { requestGMAction, GMAction } from "./GMAction.js";
var basePrepareData;
export let _characterSpec = { data: {}, flags: {} };
export const EVALPASSES = {
    IGNORE: -1,
    BASESET: 0,
    BASEADD: 1,
    PREPAREDATA: 2,
    DERIVEDSET: 4,
    DERIVEDADD: 5,
    FINALSET: 6,
    FINALADD: 7
};
let templates = {};
var secPerRound;
export var aboutTimeInstalled = false;
export var requireItemTarget = true;
export var playersCanSeeEffects = "view";
export var tokenEffects = false;
export var cubActive;
export var itemacroActive;
export var calculateArmor;
export let validateDuration = (originalDuration) => {
    if (typeof originalDuration === "string") {
        let syntheticDuration = { units: "", value: 0 };
        tokenizer.tokenize(originalDuration, (token) => {
            let possibleValue = parseInt(token);
            if (!isNaN(possibleValue)) {
                syntheticDuration.value = Math.abs(possibleValue);
            }
            else {
                if (!token.endsWith("s"))
                    token = token.concat("s");
                let possibleUnits = ["seconds", "minutes", "hours", "days", "months", "years", "rounds", "turns"].find(u => u === token.toLocaleLowerCase());
                if (possibleUnits)
                    syntheticDuration.units = possibleUnits;
            }
        });
        if (syntheticDuration.units === "")
            return { value: 0, units: "" };
        return durationUnitsMap(syntheticDuration);
    }
    let duration = duplicate(originalDuration);
    if (duration.units !== undefined && duration.value !== undefined) {
        if (duration.units === "")
            return { value: 0, units: "seconds" };
        if (duration.units.length > 0 && duration.units[duration.units.length - 1] !== "s")
            duration.units = `${duration.units}s`;
        if (!["hours", "minutes", "seconds", "years", "months", "days", "turns", "inst", "rounds"].includes(duration.units))
            duration.units = "rounds";
        if (isNaN(duration.value) || duration.value < 0)
            duration.value = 1;
        return durationUnitsMap(duration);
    }
    return { value: 0, units: "" };
};
export let durationUnitsMap = (duration) => {
    let roundDuration = aboutTimeInstalled ? game.settings.get("about-time", "seconds-per-round") : 6;
    switch (duration.units) {
        case "inst":
            duration.units = "";
            break;
        case "turns":
            duration.units = "seconds";
            duration.value = roundDuration * duration.value;
            break;
        case "rounds":
            duration.units = "seconds";
            duration.value = roundDuration * duration.value;
    }
    return duration;
};
let debugLog = false;
let acAffectingArmorTypes = [];
function debug(...args) {
    console.log("Dynamiceffects | ", ...args);
}
export class ModSpec {
    constructor(field, label, pass, sampleValue) {
        this.field = "";
        this.label = "";
        this.pass = 0;
        this.mode = ""; // "" -> overwrite no eval, += -> nmeric/string/array append add @= -> character lookup + eval
        this.sampleValue = 0;
        this.targetIds = null; // does the affect only apply against specific targets
        this.field = field;
        this.label = label;
        this.pass = pass;
        this.sampleValue = sampleValue;
    }
    static specFor(specId) { return this.allSpecsObj[specId]; }
    static createValidMods(characterSpec = game.system.model.Actor.character) {
        var _a, _b;
        _characterSpec["data"] = duplicate(characterSpec);
        let baseValues = flattenObject(_characterSpec);
        if (game.system.id === "sw5e") { // patch for missing fields
            // data.bonuses.power.dc hoping will appear in 0.8.3
            baseValues["data.bonuses.heal.damage"] = "";
            baseValues["data.bonuses.heal.attack"] = "";
            // The way power.dc is expected to behave is as a number so treat it as such
            baseValues["data.bonuses.power.dc"] = 0;
            // dynamiceffects pseudo field
            baseValues["data.traits.languages.all"] = false;
            // dynamiceffects psuedo field 
            baseValues["data.bonuses.All-Attacks"] = false;
            baseValues["data.traits.di.all"] = false;
            baseValues["data.traits.dr.all"] = false;
            baseValues["data.traits.dv.all"] = false;
            baseValues["data.powers.pact.level"] = 0;
        }
        if (game.system.id === "sw5e") { // patch for missing fields
            // data.bonuses.power.dc hoping will appear in 0.8.3
            baseValues["data.bonuses.heal.damage"] = "";
            baseValues["data.bonuses.heal.attack"] = "";
            // The way power.dc is expected to behave is as a number so treat it as such
            baseValues["data.bonuses.power.dc"] = 0;
            // dynamiceffects pseudo field
            baseValues["data.traits.languages.all"] = false;
            // dynamiceffects psuedo field 
            baseValues["data.bonuses.All-Attacks"] = false;
            baseValues["data.traits.di.all"] = false;
            baseValues["data.traits.dr.all"] = false;
            baseValues["data.traits.dv.all"] = false;
            baseValues["data.powers.pact.level"] = 0;
        }		
        //@ts-ignore
        if ((_a = game.modules.get("gm-notes")) === null || _a === void 0 ? void 0 : _a.active) {
            baseValues["flags.gm-notes.notes"] = "";
        }
        // baseSpecs are all those fields defined in template.json game.system.model and are things the user can directly change
        this.baseSpecs = Object.keys(baseValues).map(spec => new ModSpec(spec, spec, EVALPASSES.BASESET, baseValues[spec]));
        // Do the system specific part
        if (game.system.id === "sw5e") {
            // 1. abilities add mod and save to each;
            Object.keys(_characterSpec.data.abilities).forEach(ablKey => {
                let abl = _characterSpec.data.abilities[ablKey];
                abl.mod = 0;
                abl.saveBonusDE = 0;
                abl.min = 0;
            });
            // adjust specs for bonuses - these are strings, @fields are looked up but dice are not rolled.
            // Skills add mod, passive and bonus fields
            Object.keys(_characterSpec.data.skills).forEach(sklKey => {
                let skl = _characterSpec.data.skills[sklKey];
                skl.mod = 0;
                skl.passive = 0; // skl.bonus = 0;
            });
            this.baseSpecs = this.baseSpecs.map(spec => {
                if (spec.field.includes("data.bonuses.")) {
                    spec.pass = EVALPASSES.FINALSET;
                }
                if (spec.field === "data.bonuses.power.dc") {
                    spec.pass = EVALPASSES.BASESET;
                    spec.sampleValue = 0;
                }
                if (spec.field.includes("resources")) {
                    spec.pass = EVALPASSES.DERIVEDSET;
                }
                return spec;
            });
            // Add special fields
            // 1st group are flags that are absent in model
            // 2nd special fields check_all
            let characterFlags = CONFIG.SW5E.characterFlags; // look at using this to update the _characterSpec instead of hard coding
            mergeObject(_characterSpec, {
                "flags.sw5e.initiativeAdv": false,
                "flags.sw5e.initiativeAlert": false,
                "flags.sw5e.initiativeHalfProf": false,
                "flags.sw5e.powerfulBuild": false,
                "flags.sw5e.savageAttacks": false,
                "flags.sw5e.elvenAccuracy": false,
                "flags.sw5e.halflingLucky": false,
                "flags.sw5e.jackOfAllTrades": false,
                "flags.sw5e.observantFeat": false,
                "flags.sw5e.reliableTalent": false,
                "flags.sw5e.remarkableAthlete": false,
                "flags.sw5e.weaponCriticalThreshold": 20,
                "data.attributes.ac.value": 0,
                "data.attributes.ac.min": 0,
                "data.attributes.init.total": 0,
                "data.attributes.hd": 0,
                "data.attributes.prof": 0,
                "data.attributes.powerdc": 0,
                // "data.attributes.powerlevel":  0,
                "flags.sw5e.forceCritical": false,
                "flags.sw5e.attackAdvantage": 0,
                "flags.sw5e.conditions": [],
                "skills.all": 0,
                "macro.execute": "",
                "macro.itemMacro": ""
            }, { inplace: true, insertKeys: true, insertValues: true, overwrite: false });
            //@ts-ignore
            if ((_b = game.modules.get("tokenmagic")) === null || _b === void 0 ? void 0 : _b.active) {
                _characterSpec["macro.tokenMagic"] = "";
            }
        }
        if (tokenEffects) {
            mergeObject(_characterSpec, {
                "flags.dynamiceffects.token.visible": false,
                "flags.dynamiceffects.token.blind": false,
            }, { inplace: true, insertKeys: true, insertValues: true, overwrite: false });
        }
        let allSpecsTemp = flattenObject(_characterSpec);
        this.derivedSpecs = Object.keys(allSpecsTemp)
            .filter(specName => { return undefined === this.baseSpecs.find(vs => vs.field === specName); })
            .map(spec => { return new ModSpec(spec, spec, EVALPASSES.DERIVEDSET, allSpecsTemp[spec]); });
        this.allSpecs = this.baseSpecs.concat(this.derivedSpecs);
        if (game.system.id === "sw5e") {
            let additions = [];
            // Special case for armor/hp which can depend on derived attributes - like dexterity mod or constituion mod
            // and initiative bonus depends on advantage on initiative
            const finalSetAttributes = ["data.attributes.init.bonus",
                "data.attributes.ac.value"];
            this.allSpecs.filter(spec => finalSetAttributes.indexOf(spec.field) >= 0)
                .forEach(spec => spec.pass = EVALPASSES.FINALSET);
            this.allSpecs.forEach(m => {
                if (m.field.includes("data.attributes.hp")) {
                    m.pass = EVALPASSES.FINALSET;
                    m.sampleValue = 0;
                }
                if (m.field.includes("powers.power"))
                    m.pass = EVALPASSES.DERIVEDSET;
                if (m.field.includes("powers.pact"))
                    m.pass = EVALPASSES.DERIVEDSET;
                if (m.field.includes("override")) {
                    m.pass = EVALPASSES.BASESET;
                    m.sampleValue = 0;
                }
                if (m.field.includes("passive"))
                    m.pass = EVALPASSES.FINALSET;
                if (m.field.includes("pact.level")) {
                    m.sampleValue = 0;
                    m.pass = EVALPASSES.DERIVEDSET;
                }
            });
            this.allSpecs = this.allSpecs.concat(additions);
        }
        if (game.system.id === "pf1") {
            // this.allSpecs = this.allSpecs.map(m => {m.pass = EVALPASSES.DERIVEDSET; return m});
        }
        if (game.system.id === "pf2e") {
            // this.allSpecs = this.allSpecs.map(m => {m.pass = EVALPASSES.DERIVEDSET; return m});
            this.allSpecs.forEach(m => { if (m.field === "data.attributes.ac.value")
                m.pass = EVALPASSES.FINALSET; });
            this.allSpecs.forEach(m => { if (m.field === "data.attributes.hp.max")
                m.pass = EVALPASSES.FINALSET; });
        }
        this.allSpecs.forEach(ms => this.allSpecsObj[ms.field] = ms);
    }
    static localizeSpecs() {
        this.allSpecs = this.allSpecs.map(m => {
            m.label = m.label.replace("data.", "").replace("sw5e.", "").replace(".value", "").split(".").map(str => game.i18n.localize(`dynamiceffects.${str}`)).join(" ");
            return m;
        });
    }
}
ModSpec.allSpecs = [];
ModSpec.allSpecsObj = {};
ModSpec.baseSpecs = [];
ModSpec.derivedSpecs = [];
export class EffectModifier {
    constructor(modSpecKey, mode, value) {
        this.modSpecKey = modSpecKey;
        this.value = value;
        this.mode = mode;
        return this;
    }
    get modSpec() { return ModSpec.specFor[this.modSpecKey]; }
}
export function asMergeItem(mod) {
    let modSpec = ModSpec.specFor(mod.modSpecKey);
    if (mod.mode === "=") {
        var pass = modSpec.pass;
        var spec = modSpec.field;
    }
    else {
        var pass = modSpec.pass + 1; // do additions after assignments
        let specParts = modSpec.field.split(".");
        specParts[specParts.length - 1] = `+${specParts[specParts.length - 1]}`;
        var spec = specParts.join(".");
    }
    let item = {};
    item[`${spec}`] = mod.value;
    return item;
}
export class ItemEffect extends EffectModifier {
    constructor(id, itemId = "", modSpecKey = ModSpec.allSpecs[0].field, mode = "=", value = "", active = false, targetSpecific = false) {
        super(modSpecKey, mode, value);
        this.targetSpecific = false;
        if (debugLog)
            console.warn("creating item effect with id", id, typeof id);
        this.id = Number(id);
        this.itemId = itemId;
        this.active = active;
        this.targetSpecific = targetSpecific;
        this._targets = [];
    }
    get targets() { return this._targets; }
    set targets(targets) { this._targets = targets; }
}
let uidForActor = (actor) => {
    let uid;
    if (!actor.isToken)
        uid = actor.id;
    else
        uid = `${actor.token.id}+${actor.id}`;
    return uid;
};
export class TimedItemEffectModifier extends ItemEffect {
    constructor(id, itemData, modSpecKey, mode, value, duration = { value: 0, units: "seconds" }, active = false, targetSpecific = false) {
        super(id, itemData._id, modSpecKey, mode, value, targetSpecific);
        this._itemName = itemData.name;
        this._duration = validateDuration(duration);
        if (aboutTimeInstalled) {
            //@ts-ignore
            this._startTime = Gametime.DTNow().toSeconds();
        }
        else {
            this._startTime = Date.now();
        }
    }
    get durartion() { return this._duration; }
    set duration(duration) { this._duration = duration; }
}
export class ActorDataCache {
    static getPreparedActorDataCache(actor) {
        var _a, _b;
        return { data: ((_a = this.preparedActorDataCache[uidForActor(actor)]) === null || _a === void 0 ? void 0 : _a.data) || {}, flags: ((_b = this.preparedActorDataCache[uidForActor(actor)]) === null || _b === void 0 ? void 0 : _b.flags) || {} };
    }
    static getSavedData(actor, itemEffects) {
        let uid = uidForActor(actor);
        if (!ActorDataCache.actorDataCache[uid]) {
            if (debugLog)
                debug(`Creatisng new saved data for ${actor.data.name}`, actor.data.data, actor.data.items);
            let savedActorData = { data: {}, flags: {}, itemEffects: [] };
            setProperty(actor.data.flags, `${game.system.id}.conditions`, []); // zero out conditions since only active effects will set them
            savedActorData.data = duplicate(actor.data.data);
            savedActorData.flags = duplicate(actor.data.flags[game.system.id] || {});
            this.postPrepareData(actor);
            this.actorDataCache[uid] = savedActorData;
            return { data: actor.data.data, flags: actor.data.flags[game.system.id] || {} };
        }
        else {
            // Would base data update to happen via system notify, e.g. hooks.call but that call lags the call to preparedata so end
            // up using out of data copy.
            // Instead infer changes from differences in the actor data since we were last called.
            if (debugLog)
                debug("restoring saved data for ", actor.name);
            let preparedData = this.preparedActorDataCache[uid];
            // See what has changed in the background since the last prepare data.
            // Chnages will only be things entered for the character not dynamiceffects chagnes so we need to record those
            //@ts-ignore
            let updatesData = diffObject(preparedData.data, actor.data.data);
            //@ts-ignore
            let updatesFlags = diffObject(preparedData.flags, actor.data.flags[game.system.id] || {});
            //@ts-ignore
            let reverseFlags = diffObject(actor.data.flags[game.system.id] || {}, preparedData.flags);
            if (debugLog) {
                debug("updates since last save", duplicate(updatesData));
                debug("update flags", duplicate(preparedData.flags), duplicate(updatesFlags));
                debug("update flags", duplicate(preparedData.flags), updatesFlags, reverseFlags);
            }
            mergeObject(this.actorDataCache[uid].flags, updatesFlags, { insertKeys: true, insertValues: true, inplace: true, overwrite: true });
            mergeObject(this.actorDataCache[uid].data, updatesData, { inplace: true, insertKeys: true, insertValues: true, overwrite: true });
            // diff object does not return anything for flags missing in the second object so to detect removal we have to look for omissions
            Object.keys(reverseFlags).forEach(k => {
                if (!hasProperty(updatesFlags, k) && hasProperty(this.actorDataCache[uid], `flags.${k}`)) {
                    delete this.actorDataCache[uid].flags[k];
                }
            });
            // update the saved actor.data.data with the updates, then set the actor data to the saved data
            // update flags with changes, then actor data flags
            return { data: duplicate(this.actorDataCache[uid].data), flags: duplicate(this.actorDataCache[uid].flags) };
        }
    }
    static resetCacheForActor(actor) {
        let uid = uidForActor(actor);
        delete ActorDataCache.actorDataCache[uid];
    }
    static postPrepareData(actor) {
        let uid = uidForActor(actor);
        // save a copy of all that we calculdated so we can check changes next time through.
        this.preparedActorDataCache[uid] = { data: duplicate(actor.data.data), flags: duplicate(actor.data.flags[game.system.id] || {}), itemEffects: [] };
    }
    permanentChange(actor, change) {
    }
}
ActorDataCache.actorDataCache = {};
ActorDataCache.preparedActorDataCache = {};
let addArmorEffect = (itemData, effectList, actor) => {
    // Special case for armor
    if (itemData.data.hasOwnProperty("armor") && hasProperty(actor.data, "data.abilities.dex")
        && acAffectingArmorTypes.includes(itemData.data.armor.type)
        && (itemData.data.equipped || itemData.data.armor.type === "natural")) {
        let acValue = itemData.data.armor.value || 0;
        if (!["shield", "bonus"].includes(itemData.data.armor.type)) {
            let dexMod = itemData.data.armor.dex === 0 ? 0 : actor.data.data.abilities.dex.mod || 0;
            acValue = acValue + ([null, "", undefined].includes(itemData.data.armor.dex) ? dexMod : Math.min(itemData.data.armor.dex, dexMod));
        }
        if (itemData.data.armor.value !== 0)
            effectList.push(new EffectModifier("data.attributes.ac.value", ["shield", "bonus"].includes(itemData.data.armor.type) ? "+" : "=", acValue));
    }
};
export let hasItemActiveEffects = (itemData) => {
    return (getProperty(itemData, "flags.dynamiceffects.effects") || []).some(effect => effect.active && !effect.targetSpecific);
};
// active effects do not activate when the item is equipped/cursed - they must be applied
export let getItemActiveEffects = (itemData) => {
    // let itemData = item.data;
    // use the item specified duration to set the duration for the effect
    //let duration = itemData.data.duration.value ? {value: itemData.data.duration.value, units: itemData.data.duration.units} : {value: 1, units: "round"};
    // constructing TimedItemEffectModifier tags the start time as "now"
    let effects = (getProperty(itemData, "flags.dynamiceffects.effects") || []).filter(effect => { return effect.active && !effect.targetSpecific; });
    if (game.system.id === "sw5e") {
        effects = effects.reduce((effectList, effect) => effectList.concat(expandSpecial(effect)), []);
    }
    effects = effects.map(ed => new TimedItemEffectModifier(1, itemData, ed.modSpecKey, ed.mode, ed.value, itemData.data.duration, true, false));
    return effects;
};
export let getItemActiveTargetedEffects = (itemData) => {
    // let itemData = item.data;
    // use the item specified duration to set the duration for the effect
    //let duration = itemData.data.duration.value ? {value: itemData.data.duration.value, units: itemData.data.duration.units} : {value: 1, units: "round"};
    // constructing TimedItemEffectModifier tags the start time as "now"
    let effects = (getProperty(itemData, "flags.dynamiceffects.effects") || []).filter(effect => { return effect.active && effect.targetSpecific; });
    if (game.system.id === "sw5e") {
        effects = effects.reduce((effectList, effect) => effectList.concat(expandSpecial(effect)), []);
    }
    effects = effects.map(ed => new TimedItemEffectModifier(1, itemData, ed.modSpecKey, ed.mode, ed.value, itemData.data.duration, true, true));
    return effects;
};
export let itemHasPassiveEffects = (item) => {
    return getItemPassiveEffects(item.data).length > 0;
};
// Get active or passive effects for an item.
export let getItemPassiveEffects = (itemData) => {
    return (getProperty(itemData.flags, "dynamiceffects.effects") || [])
        .filter(em => !em.active && (em.targetIds || []).length === 0)
        .map(em => new EffectModifier(em.modSpecKey || "data.abilities.str.value", em.mode || "+", em.value || 0));
};
// get passive item effects for items that are active (equipped/always active etc)
let getAllItemPassiveEffects = (actor, active = false, itemId = "") => {
    var itemEffects = actor.data.items
        .filter(itemData => hasProperty(itemData, "flags.dynamiceffects.effects") || (calculateArmor && hasProperty(itemData, "data.armor")))
        .reduce((effectList, itemData) => {
        if (calculateArmor)
            addArmorEffect(itemData, effectList, actor);
        if (hasProperty(itemData, "flags.dynamiceffects.effects") && isActive(itemData)) {
            effectList = effectList.concat(getItemPassiveEffects(itemData));
        }
        return effectList;
    }, []);
    // use this if needing to map a modspec key to something else
    //    .map(ef => {ef.modSpecKey = ef.modSpecKey.replace(/data.abilities.(...).saveBonus/, "data.abilities.$1.saveBonusDE"); console.log("ef is ", ef); return ef;}); 
    // see if there are any special effects to process - these are sw5e specific.
    if (game.system.id === "sw5e") {
        itemEffects = itemEffects.reduce((effectList, effect) => effectList.concat(expandSpecial(effect)), []);
    }
    if (debugLog)
        debug("For actor effects are ", actor.name, itemEffects);
    return itemEffects;
};
// get actor active effects i.e. active effects that have been applied to the actor
let getActiveActorEffects = (actor) => {
    const activeEffects = (getProperty(actor.data.flags, "dynamiceffects.activeEffects") || []).map(em => new EffectModifier(em.modSpecKey || "data.abilities.str.value", em.mode || "+", em.value || 0));
    if (game.system.id === "sw5e") {
        return activeEffects.reduce((effectList, effect) => effectList.concat(expandSpecial(effect)), []);
    }
    return activeEffects;
};
export let activateItemEffectsForTargets = async (doMacros, targetIdList, itemData, context, powerLevel, damageTotal = null) => {
    return activateEffectsForTargets(doMacros, targetIdList, getItemActiveEffects(itemData), itemData, context, powerLevel, damageTotal);
};
export let activateItemEffectsForToken = async (doMacros, token, itemData, context, powerLevel, damageTotal = null) => {
    if (typeof token === "string")
        token = canvas.tokens.get(token);
    return activateEffectsFor(doMacros, token, getItemActiveEffects(itemData), itemData, context, powerLevel, damageTotal);
};
export let activateEffectsFor = async (doMacros, token, effectListData, itemData, context, powerLevel, damageTotal = null) => {
    if (typeof token === "string") {
        token = canvas.tokens.get(token);
    }
    let actor = token.actor;
    //@ts-ignore
    let actorEffects = [];
    effectListData.forEach(async (ef) => {
        var _a, _b, _c;
        let fields = [];
        if (typeof ef.value === "string") {
            tokenizer.tokenize(ef.value, (token) => fields.push(token));
            fields = fields.map(f => {
                if (f === "@target")
                    return token.id;
                else if (f === "@scene")
                    return canvas.scene.id;
                else if (f === "@target.Actor")
                    return token.actor.id;
                else if (f === "@token")
                    return ChatMessage.getSpeaker().token;
                else if (f === "@item")
                    return itemData;
                else if (f === "@powerLevel")
                    return powerLevel;
                else if (f === "@item.level")
                    return powerLevel;
                else if (f === "@damage")
                    return damageTotal;
                //@ts-ignore
                else if (f === "@unique")
                    return randomID();
                else
                    return doLookups(f, context);
            });
        }
        if (ef.modSpecKey.startsWith("macro") && doMacros) {
            var macro;
            var offArgs;
            if (ef.modSpecKey === "macro.execute" || ef.modSpecKey === "macro.macroExecute") { // maintain compat for mistaken version
                //@ts-ignore
                macro = game.macros.getName(fields[0]);
                offArgs = ["off", ...fields.slice(1)];
            }
            else if (ef.modSpecKey === "macro.itemMacro") {
                let macroCommand = ((_c = (_b = (_a = itemData.flags.itemacro) === null || _a === void 0 ? void 0 : _a.macro) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.command) || "";
                // macroCommand = `ChatMessage.create({content: "Item macro for ${itemData.name} called"})\n` + macroCommand;
                if (!macroCommand)
                    return;
                macro = await CONFIG.Macro.entityClass.create({
                    name: "DynamicEffects-Item-Macro",
                    type: "script",
                    img: itemData.img,
                    command: macroCommand,
                    flags: { "sw5e.itemMacro": true }
                }, { displaySheet: false, temporary: true });
                fields = ["DynamicEffects-Item-Macro"].concat(fields);
                offArgs = [itemData, "off", ...fields.slice(1)];
            }
            else if (ef.modSpecKey === "macro.tokenMagic") { // check module enabled
                //@ts-ignore
                let tokenMagic = window.TokenMagic;
                if (tokenMagic && token) {
                    let tokenMagicEffect = tokenMagic.addFilters(token, fields[0]);
                    if (aboutTimeInstalled) {
                        let duration = validateDuration(itemData.data.duration);
                        if (duration.value !== 0) {
                            let spec = {};
                            spec[duration.units] = duration.value;
                            // debug("mapped duration is ", durationMap(item.data.data.duration));
                            game.Gametime.doIn(spec, localDeleteFilters, token.id, fields[0]);
                        }
                        else {
                            setTimeout(() => {
                                tokenMagic.deleteFilters(token, fields[0]);
                            }, 3000);
                        }
                    }
                }
                return;
            }
            try {
                macro && macro.execute("on", ...fields.slice(1));
            }
            catch (err) {
                console.warn("Dynamiceffects | macro error when applying active effects with macro ", fields[0], err);
                return null;
                throw new Error("macro error");
            }
            if (aboutTimeInstalled) {
                let duration = validateDuration(itemData.data.duration);
                if (duration.value !== 0) {
                    let spec = {};
                    spec[duration.units] = duration.value;
                    // debug("mapped duration is ", durationMap(item.data.data.duration));
                    game.Gametime.doIn(spec, fields[0], ...offArgs);
                }
            }
        }
        else if (!doMacros) {
            if (actor) {
                if (typeof ef.value === "string")
                    ef.value = doLookups(fields.join(""), context);
                actorEffects.push(ef);
            }
        }
    });
    if (actorEffects === null || actorEffects === void 0 ? void 0 : actorEffects.length) {
        actorEffects = (getProperty(actor.data.flags, "dynamiceffects.activeEffects") || []).concat(actorEffects);
        if (actor)
            return actor.update({ "flags.dynamiceffects.activeEffects": actorEffects });
    }
    return null;
};
export function localDeleteFilters(tokenId, filterName) {
    //@ts-ignore
    let tokenMagic = window.TokenMagic;
    let token = canvas.tokens.get(tokenId);
    tokenMagic.deleteFilters(token, filterName);
}
// add a list of active effects to the actor
export let activateEffectsForTargets = async (doMacros, targetIdList, effectListData, itemData, context, powerLevel, damageTotal = null) => {
    let promises = [];
    (targetIdList || []).forEach((tId) => {
        let token = canvas.tokens.get(tId);
        if (token === null || token === void 0 ? void 0 : token.actor) {
            let update = activateEffectsFor(doMacros, token, effectListData, itemData, context, powerLevel, damageTotal);
            if (update)
                promises.push(update);
        }
    });
    Promise.all(promises);
    return promises;
};
// remove all actor effects from the given actor
export let removeAllActorIdEffects = async (actorId) => {
    let actor = game.actors.get(actorId);
    if (actor)
        return await actor.update({ "flags.dynamiceffects.activeEffects": [] }, {});
    return null;
};
export let removeAllTokenEffects = async (token) => {
    // cancel any special token effects e.g. invisible, blinded
    if (token.actor)
        return await token.actor.update({ "flags.dynamiceffects.activeEffects": [] }, {});
    return null;
};
export let removeAllTokenIdEffects = async (tokenId) => {
    let token = canvas.tokens.get(tokenId);
    if (token)
        return removeAllTokenEffects(token);
};
let checkExpiredActions = (combat) => {
    return;
    console.log("check active combat is ", combat, combat.current, combat.previous);
};
export let removeAllItemActiveEffectsActorId = async (actorId, itemData) => {
    let actor = game.actors.get(actorId);
    return await removeAllItemActiveEffectsActor(actor, itemData);
};
export let removeAllItemActiveEffectsTargets = async (targetList, itemData) => {
    await targetList.forEach(async (tokenId) => await removeAllItemActiveEffectsTokenId(tokenId, itemData));
};
export let removeAllItemActiveEffectsTokenId = async (tokenId, itemData) => {
    let token = canvas.tokens.get(tokenId);
    if (!token)
        return null;
    await removeAllItemActiveEffectsActor(token.actor, itemData);
    if (cubActive)
        removeActiveConditionsTokenItem(token, itemData);
};
export let removeActiveConditionsTokenItem = async (token, itemData) => {
    var _a, _b, _c;
    let dynamicEffects = (_b = (_a = itemData.flags) === null || _a === void 0 ? void 0 : _a.dynamiceffects) === null || _b === void 0 ? void 0 : _b.effects;
    if (dynamicEffects) {
        let activeConditions = dynamicEffects.filter(ef => ef.active && ef.modSpecKey === "flags.sw5e.conditions");
        let tokenList = [token];
        if (token.data.actorLink) {
            tokenList = token.actor.getActiveTokens();
        }
        //@ts-ignore
        const conditionList = ((_c = game.cub) === null || _c === void 0 ? void 0 : _c.conditions) || {};
        if (tokenList.length > 0)
            activeConditions.forEach(ef => {
                for (let j = 0; j < conditionList.length; j++) {
                    const id = conditionList[j].name || "";
                    if (ef.value === id) {
                        if (debugLog)
                            debug("Removing condition ", id, token);
                        //@ts-ignore
                        tokenList.forEach(token => game.cub.removeCondition(id, token, { warn: false }));
                    }
                }
            });
    }
};
export let removeAllItemActiveEffectsActor = async (actor, itemData) => {
    if (!actor)
        return null;
    let activeEffects = getProperty(actor.data, "flags.dynamiceffects.activeEffects") || [];
    //@ts-ignore
    activeEffects = activeEffects.filter(tem => tem.itemId !== itemData._id);
    Hooks.once("preUpdateActor", () => actor.data.flags.dynamiceffects.activeEffects = activeEffects);
    await actor.update({ "flags.dynamiceffects.activeEffects": activeEffects }, {});
};
// some computed fields need to be updated after all the conversion passes are complete
let fixupComputedFields = (actor) => {
    var _a, _b;
    if (game.system.id === "sw5e") {
        let originalSaves = null;
        let originalSkills = null;
        // If we are a polymorphed actor, retrieve the skills and saves data from
        // the original actor for later merging.
        if (actor.isPolymorphed) {
            const transformOptions = actor.getFlag('sw5e', 'transformOptions');
            const original = (_a = game.actors) === null || _a === void 0 ? void 0 : _a.get(actor.getFlag('sw5e', 'originalActor'));
            if (original) {
                if (transformOptions.mergeSaves) {
                    originalSaves = original.data.data.abilities;
                }
                if (transformOptions.mergeSkills) {
                    originalSkills = original.data.data.skills;
                }
            }
        }
        // fix up skills
        if (actor.data.data.skills) {
            //@ts-ignore
            const feats = game.sw5e.config.characterFlags;
            const flags = actor.data.flags.sw5e || {};
            const observant = flags.observantFeat;
            const athlete = flags.remarkableAthlete;
            const joat = flags.jackOfAllTrades;
            let round = Math.floor;
            for (let [id, skl] of Object.entries(actor.data.data.skills)) {
                //@ts-ignore
                let multi = skl.value;
                //@ts-ignore
                if (athlete && (skl.value === 0) && feats.remarkableAthlete.abilities.includes(skl.ability)) {
                    multi = 0.5;
                    round = Math.ceil;
                }
                //@ts-ignore
                if (joat && (skl.value === 0))
                    multi = 0.5;
                //@ts-ignore
                skl.value = parseFloat(skl.value || 0);
                //@ts-ignore
                //skl.mod = actor.data.data.abilities[skl.ability].mod;
                //@ts-ignore
                skl.prof = round(multi * actor.data.data.attributes.prof);
                //@ts-ignore
                skl.total = skl.mod + skl.prof + skl.bonus;
                const passive = observant && (feats.observantFeat.skills.includes(id)) ? 5 : 0;
                //@ts-ignore
                skl.passive = 10 + skl.total + passive;
            }
        }
        const bonuses = ((_b = actor.data.data.bonuses) === null || _b === void 0 ? void 0 : _b.abilities) || {};
        ;
        //@ts-ignore
        const saveBonus = Number.isNumeric(bonuses === null || bonuses === void 0 ? void 0 : bonuses.save) ? parseInt(bonuses.save) : 0;
        for (let [id, abl] of Object.entries(actor.data.data.abilities)) {
            //@ts-ignore
            abl.prof = (abl.proficient || 0) * actor.data.data.attributes.prof;
            //@ts-ignore
            abl.saveBonus = saveBonus;
            //@ts-ignore
            abl.save = abl.mod + abl.prof + abl.saveBonus + (abl.saveBonusDE || 0);
            // If we merged saves when transforming, take the highest bonus here.
            //@ts-ignore
            if (originalSaves && abl.proficient) {
                //@ts-ignore
                abl.save = Math.max(abl.save, originalSaves[id].save);
            }
        }
    }
};
// The workhorse that applies all passive and actor effects to the actor
class DynamicEffectsPatching extends Actor {
    baseData() {
        return ActorDataCache.getSavedData(this, []);
    }
    prepareData() {
        var _a, _b, _c;
        // let itemEffects = getAllItemPassiveEffects(this, false); // get passive effects for items that are active
        let allEffects = getAllItemPassiveEffects(this, false).concat(getActiveActorEffects(this));
        let { data, flags } = ActorDataCache.getSavedData(this, allEffects);
        this.data.data = data;
        this.data.flags[game.system.id] = flags;
        if (debugLog)
            debug("effects are ", allEffects);
        Object.keys(EVALPASSES).forEach(k => {
            let updatedContext = false;
            let context = {};
            let pass = EVALPASSES[k];
            if (pass === EVALPASSES.IGNORE)
                return;
            if (debugLog)
                debug('Doing pass', k);
            if (pass === EVALPASSES.PREPAREDATA) {
                try {
                    basePrepareData.bind(this)();
                }
                catch (err) {
                    console.error(err);
                }
                ;
            }
            else
                allEffects.forEach((effect) => {
                    // addition mods go one pass later.
                    let effectPass = ModSpec.allSpecsObj[effect.modSpecKey] && ModSpec.allSpecsObj[effect.modSpecKey].pass + (effect.mode === "+" ? 1 : 0);
                    if (pass === effectPass) {
                        if (!updatedContext) {
                            //@ts-ignore
                            context = this.getRollData();
                            updatedContext = true;
                        }
                        //@ts-ignore
                        mergeObjectPlusLookup(this.data, asMerge(effect), { inplace: true, insertKeys: true, insertValues: true, context: context, debug: false, sampleValue: ModSpec.allSpecsObj[effect.modSpecKey].sampleValue });
                    }
                });
            if (pass === EVALPASSES.FINALSET) {
                fixupComputedFields(this);
            }
        });
        // update tokens for condition?
        //@ts-ignore
        if ((canvas === null || canvas === void 0 ? void 0 : canvas.tokens) && game.system.id === "sw5e" && cubActive && game.user.isGM && (game.user === game.users.entities.find(u => u.isGM && u.active))) {
            const conditions = ((_b = (_a = this.data.flags) === null || _a === void 0 ? void 0 : _a.sw5e) === null || _b === void 0 ? void 0 : _b.conditions) || [];
            if (conditions.length > 0) {
                let tokenList = this.token ? [this.token] : this.getActiveTokens().filter(t => t.data.actorLink);
                //@ts-ignore
                const conditionList = ((_c = game.cub) === null || _c === void 0 ? void 0 : _c.conditions) || {};
                for (let i = 0; i < tokenList.length; i++) {
                    const token = tokenList[i];
                    //@ts-ignore
                    // game.cub.removeAllConditions(token)
                    for (let j = 0; j < conditionList.length; j++) {
                        const id = conditionList[j].name || "";
                        if (conditions.includes(id)) {
                            if (debugLog)
                                debug("Applying condition ", id, token);
                            //@ts-ignore
                            game.cub.applyCondition(id, token, { warn: false });
                        }
                    }
                }
            }
        }
        ActorDataCache.postPrepareData(this); // record the current state of the actor after effects applied
        return this;
    }
}
let asMerge = (mod) => {
    let modSpec = ModSpec.specFor(mod.modSpecKey);
    if (mod.mode === "=") {
        var pass = modSpec.pass;
        var spec = modSpec.field;
    }
    else {
        let specParts = modSpec.field.split(".");
        specParts[specParts.length - 1] = `+${specParts[specParts.length - 1]}`;
        var spec = specParts.join(".");
    }
    let item = {};
    item[`${spec}`] = mod.value;
    return item;
};
// Is the item active? i.e. armor, or equiped or always active
export let isActive = (itemData) => {
    // This test is to allow natural armor effects to be active even if no other flag set.
    if (itemData.data.hasOwnProperty("armor.type") && itemData.data.armor.type === "natural")
        return true;
    if (!itemData.flags.hasOwnProperty("dynamiceffects"))
        return false;
    if (getProperty(itemData, "flags.dynamiceffects.alwaysActive"))
        return true;
    if (hasProperty(itemData.data, "equipped") && !itemData.data.equipped)
        return false;
    if (getProperty(itemData.data, "attuned") || getProperty(itemData, "flags.dynamiceffects.equipActive"))
        return true;
    return false;
};
// a few sw specific extensions
function expandSpecial(effect) {
    let checkList = [];
    switch (effect.modSpecKey) {
        case "data.traits.languages.all":
            return [new EffectModifier("data.traits.languages.value", "=", Object.keys(CONFIG.SW5E.languages))];
        // return [new ItemEffect(0, "All Languages", "data.traits.languages.value", "=", Object.keys(CONFIG.SW5E.languages), "Array", "baseEffect")];
        case "skills.all":
            return Object.keys(CONFIG.SW5E.skills).map(skillId => new EffectModifier(`data.skills.${skillId}.mod`, effect.mode, effect.value));
            return checkList;
        case "data.bonuses.All-Attacks":
            return ["data.bonuses.mwak.attack", "data.bonuses.rwak.attack", "data.bonuses.msak.attack", "data.bonuses.rsak.attack"].map(spec => new EffectModifier(spec, "+", effect.value));
        case "data.traits.di.all":
            return [new EffectModifier("data.traits.di.value", "=", Object.keys(CONFIG.SW5E.damageTypes))];
        case "data.traits.dr.all":
            return [new EffectModifier("data.traits.dr.value", "=", Object.keys(CONFIG.SW5E.damageTypes))];
        case "data.traits.dv.all":
            return [new EffectModifier("data.traits.dv.value", "=", Object.keys(CONFIG.SW5E.damageTypes))];
        default:
            return [effect];
    }
}
// replace the standard Actor.prepareData with our prepareData - for sw5e this is Actor5e.prepareData
function setupProxy() {
    basePrepareData = CONFIG.Actor.entityClass.prototype.prepareData;
    CONFIG.Actor.entityClass.prototype.prepareData = DynamicEffectsPatching.prototype.prepareData;
    CONFIG.Actor.entityClass.prototype.baseData = DynamicEffectsPatching.prototype.baseData;
}
export var tokenizer;
export function dynamiceffectsInitActions() {
    setupProxy();
    if (game.system.id === "sw5e") {
        acAffectingArmorTypes = ["light", "medium", "heavy", "bonus", "natural", "shield"];
    }
    fetchParams();
    ModSpec.createValidMods();
    //@ts-ignore
    tokenizer = new DETokenizeThis({
        shouldTokenize: ['(', ')', ',', '*', '/', '%', '+', '=', '!=', '!', '<', '>', '<=', '>=', '^']
    });
}
export function dynamiceffectsSetupActions() {
    var _a, _b, _c, _d;
    //@ts-ignore
    cubActive = (_a = game.modules.get("combat-utility-belt")) === null || _a === void 0 ? void 0 : _a.active;
    //@ts-ignore
    debug("Combat utility belt active ", cubActive, " and cub version is ", (_b = game.modules.get("combat-utility-belt")) === null || _b === void 0 ? void 0 : _b.data.version);
    //@ts-ignore
    if (cubActive && !isNewerVersion((_c = game.modules.get("combat-utility-belt")) === null || _c === void 0 ? void 0 : _c.data.version, "1.1.1")) {
        ui.notifications.warn("Combat Utility Belt needs to be version 1.1.2 or later - conditions disabled");
        console.warn("Combat Utility Belt needs to be version 1.1.2 or later - conditions disabled");
        cubActive = false;
    }
    else if (cubActive) {
        debug("Dynamiceffects | Combat Utility Belt active and conditions enabled");
    }
    //@ts-ignore
    itemacroActive = (_d = game.modules.get("itemacro")) === null || _d === void 0 ? void 0 : _d.active;
}
export function fetchParams() {
    requireItemTarget = game.settings.get("dynamiceffects", "requireItemTarget");
    playersCanSeeEffects = game.settings.get("dynamiceffects", "playersCanSeeEffects");
    tokenEffects = game.settings.get("dynamiceffects", "tokenEffects");
    calculateArmor = game.settings.get("dynamiceffects", "calculateArmor");
}
export function dynamiceffectsReadyActions() {
    var _a;
    ModSpec.localizeSpecs();
    //@ts-ignore
    aboutTimeInstalled = (_a = game.modules.get("about-time")) === null || _a === void 0 ? void 0 : _a.active;
    if (aboutTimeInstalled)
        secPerRound = game.settings.get("about-time", "seconds-per-round") || 6;
    else
        secPerRound = 6;
    Hooks.on("updateCombat", combatHandler);
    Hooks.on("deleteCombat", deleteCombatHandler);
}
let combats = {};
let combatHandler = (combat, updateData, otherData, userId) => {
    return;
    combat[combat.id] = combat;
    combats[combat.id] = { current: combat.current, previous: combat.previous, turns: combat.turns };
    checkExpiredActions(combats[combat.id]);
};
let deleteCombatHandler = (combat, id, options) => {
    delete combats[combat.id];
};
export let doEffects = ({ item, actor, activate, targets = undefined, whisper = false, powerLevel = 0, damageTotal = null }) => {
    var _a;
    let itemData = item.data;
    if (!hasItemActiveEffects(itemData))
        return;
    let targetIds = [];
    if (game.system.id === "sw5e") {
        if (requireItemTarget && !item.hasTarget) {
            // cannot target anyone
            ui.notifications.warn(`${game.i18n.localize("dynamiceffects.notTargetItem")}`);
            console.warn(`DynamicEffects | ${item.name} does not have targets`);
            return;
        }
        if (((_a = itemData.data.target) === null || _a === void 0 ? void 0 : _a.type) === "self") { // power effects just self
            const speaker = ChatMessage.getSpeaker();
            if (speaker.token && speaker.actor === actor.id) { // use the selected token as the target
                targetIds = [speaker.token];
            }
            else if (actor.token) {
                targetIds = [actor.token.data._id];
            }
            else {
                const target = actor.getActiveTokens().find(t => t.data.actorLink);
                targetIds = target ? [target.id] : [];
            }
            if (targetIds.length === 0) {
                console.warn("Dynamic Effects | can't work out who self is");
                return;
            }
        }
        else { // we need to get the targets
            //@ts-ignore
            if (!targets)
                targets = game.user.targets;
            for (let target of targets)
                targetIds.push(target.id);
        }
    }
    else { // Just use the targeted set
        //@ts-ignore
        if (!targets)
            targets = game.user.targets;
        for (let target of targets) {
            targetIds.push(target.id);
        }
    }
    let action = activate ? GMAction.actions.activateItemEffectsForTargets : GMAction.actions.removeAllItemActiveEffectsTargets;
    if (getItemActiveEffects(item.data).some(ef => !ef.modSpecKey.includes("macro"))) {
        requestGMAction(action, { userId: game.user.id, actorId: actor.id, targetList: targetIds, itemData: item.data, context: actor.getRollData(), whisper, powerLevel });
        if (aboutTimeInstalled && activate && item.data.data.duration) {
            let duration = validateDuration(item.data.data.duration);
            if (duration.value > 0) {
                let spec = {};
                spec[duration.units] = duration.value;
                //@ts-ignore
                game.Gametime.doIn(spec, DynamicEffects.requestGMAction, DynamicEffects.GMAction.actions.removeAllItemActiveEffectsTargets, { userId: game.user.id, actorId: actor.id, targetList: targetIds, itemData: item.data, context: actor.getRollData(), whisper });
            }
        }
        else
            debug(`DynamicEffects | no duration specified for ${item.name} effect removal NOT scheduled`);
    }
    if (activate) {
        activateItemEffectsForTargets(true, targetIds, item.data, actor.getRollData(), powerLevel, damageTotal);
    }
};
