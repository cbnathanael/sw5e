import { requestGMAction, GMAction } from "./GMAction.js";
import { aboutTimeInstalled, isActive, ModSpec, getItemPassiveEffects, doEffects, removeAllTokenEffects, playersCanSeeEffects, validateDuration } from "./dynamiceffects.js";
import { ActiveItemSelector } from "./apps/ActiveitemSelector.js";
export let applyActive = (itemName, activate = true, itemType = "") => {
    var actor;
    if (canvas.tokens.controlled.length > 0) {
        actor = canvas.tokens.controlled[0].actor;
    }
    if (!actor)
        actor = game.actors.get(ChatMessage.getSpeaker().actor);
    if (!actor) {
        ui.notifications.warn(`${game.i18n.localize("dynamiceffects.noSelection")}`);
        return;
    }
    let item = actor.items.find(i => i.name === itemName && (itemType === "" || i.type === itemType));
    if (!item) {
        console.log("Dynamic Effectss | No such item ", itemName, actor.name);
        return;
    }
    return doEffects({ item, actor, activate });
};
export let activateItem = () => {
    //@ts-ignore cant do anything if there are no targets
    const speaker = ChatMessage.getSpeaker();
    const token = canvas.tokens.get(speaker.token);
    if (!token) {
        ui.notifications.warn(`${game.i18n.localize("dynamiceffects.noSelection")}`);
        return;
    }
    return new ActiveItemSelector(token.actor, {}).render(true);
};
let effectNameString = function (actor, item, active) {
    let btnStyling = 'width: 22px; height:22px; font-size:10px;line-height:1px';
    btnStyling = "width: 60px; padding:0px; line-height:1px;";
    if (!active)
        btnStyling = btnStyling.concat("font-weight: bold; color: green");
    let activeString = active ? `${game.i18n.localize("dynamiceffects.disable")}`
        : `${game.i18n.localize("dynamiceffects.enable")}`;
    let buttonID = `${item.name}`;
    let btntxt = `<button type="button" id="[${item.name}][${item.type}]" style="${btnStyling}">${activeString}</button>`;
    return `<div class="dynamiceffects-toggle dynamiceffects-${active ? "active" : "inactive"}-button">${item.name}: ${btntxt}</div>`;
    //               : `<div class="dynamiceffects-toggle id="${item.name}" dynamiceffects-inactive-button">${item.name}: ${btntxt}</div>`;
};
export let getEffects = (allEffects = false, summary = true, { token = null, activeOnly = false }) => {
    if (typeof token === "string")
        token = canvas.tokens.get(token);
    if (!token)
        return { passive: [], active: [] };
    let passives = token.actor.items.filter(i => (allEffects || isActive(i.data)) && getItemPassiveEffects(i.data).length > 0);
    if (summary)
        passives = passives.map(i => { return { name: i.name, id: i.id }; });
    else
        passives = passives.map(i => { return { name: i.name, id: i.id, applied: isActive(i.data), effects: duplicate(i.data.flags.dynamiceffects) }; });
    let activeEffects = getProperty(token.actor.data.flags, "dynamiceffects.activeEffects") || [];
    return { passive: passives, active: activeEffects };
};
let createEffectString = (actor, detailed, activeOnly = false) => {
    let effectString = "";
    actor.items.forEach(item => {
        var _a, _b, _c;
        if (((_b = (_a = item.data.flags) === null || _a === void 0 ? void 0 : _a.dynamiceffects) === null || _b === void 0 ? void 0 : _b.effects) && !activeOnly) {
            let itemEffects = getItemPassiveEffects(item.data);
            if (itemEffects.length > 0) {
                let active = isActive(item.data);
                effectString = effectString.concat(effectNameString(actor, item, active));
                if (detailed && (playersCanSeeEffects !== "none" || game.user.isGM)) {
                    for (let effect of itemEffects) {
                        let effectLabel = ((_c = ModSpec.allSpecsObj[effect.modSpecKey]) === null || _c === void 0 ? void 0 : _c.label) || effect.modSpecKey;
                        let effectLine = `<div class="dynamiceffects-${active ? 'active' : 'inactive'}-itemeffect">${game.i18n.localize(effectLabel)} ${effect.mode === "=" ? "=" : ""} ${effect.value}</div>`;
                        effectString = effectString.concat(effectLine);
                    }
                }
            }
        }
    });
    let activeEffects = getProperty(actor.data.flags, "dynamiceffects.activeEffects") || [];
    if (activeEffects.length > 0)
        effectString = effectString.concat(game.i18n.localize("dynamiceffects.actoreffects") + "<br>");
    let itemName = "";
    activeEffects.forEach(ae => {
        if (ae._itemName !== itemName) {
            let timeRemaining = "";
            if (aboutTimeInstalled) {
                let mod = {};
                mod[ae._duration.units] = -ae._duration.value;
                timeRemaining = game.Gametime.DTM.timeString(ae._startTime - game.Gametime.DTNow().add(mod).toSeconds());
            }
            effectString = effectString.concat(`<div class="dynamiceffects-active-toggle">${ae._itemName} [${timeRemaining}] <a class="active-effect-delete" id="${ae.itemId}" title="{{localize dynamiceffects.Delete}}"><i class="fas fa-trash"></i></a></div>`);
            itemName = ae._itemName;
        }
        if (detailed && (playersCanSeeEffects !== "none" || game.user.isGM)) {
            let effectLabel = ModSpec.allSpecsObj[ae.modSpecKey].label;
            let effectLine = `<div class="dynamiceffects-active-itemeffect">${game.i18n.localize(effectLabel)} ${ae.mode === "=" ? "=" : ""} ${ae.value}</div>`;
            effectString = effectString.concat(effectLine);
        }
    });
    if (effectString.length === 0)
        effectString = "No Effects";
    return effectString;
};
export let dynamiceffectsShowEffects = (detailed = true, { token = null, activeOnly = false } = {}) => {
    const speaker = ChatMessage.getSpeaker();
    token = token || canvas.tokens.get(speaker.token);
    if (!token) {
        ui.notifications.warn(`${game.i18n.localize("dynamiceffects.noSelection")}`);
        return;
    }
    return effectsActor(detailed, { token, activeOnly });
};
export let effectsActor = (detailed = true, { token = null, actor = null, activeOnly = false }) => {
    var _a, _b;
    if (!(token === null || token === void 0 ? void 0 : token.actor) && !actor)
        return;
    let flavor = `${"Effect List"}`;
    let effectString = createEffectString((token === null || token === void 0 ? void 0 : token.actor) || actor, detailed, activeOnly);
    const speaker = { actor: ((_a = token === null || token === void 0 ? void 0 : token.actor) === null || _a === void 0 ? void 0 : _a.id) || actor.id, alias: ((_b = token === null || token === void 0 ? void 0 : token.actor) === null || _b === void 0 ? void 0 : _b.name) || actor.name, token: token === null || token === void 0 ? void 0 : token.id };
    ChatMessage.create({
        user: game.user.id,
        speaker,
        content: effectString,
        whisper: [game.user.id],
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        flags: { dynamiceffectsEffects: true, detailed: detailed }
    });
};
let activateHandler = async (message, html, data) => {
    if (!getProperty(message, "data.flags.dynamiceffectsEffects"))
        return;
    let buttons = html.find(".dynamiceffects-toggle");
    const speaker = message.data.speaker;
    const token = canvas.tokens.get(speaker.token);
    let actor = token === null || token === void 0 ? void 0 : token.actor;
    if (!actor)
        actor = game.actors.get(speaker.actor);
    if (!actor)
        return;
    for (let i = 0; i < buttons.length; i++) {
        let button = buttons[i];
        const matches = button.children[0].id.match(/\[([^\]]*)\]\[([^\]]*)\]/);
        if (!matches)
            return;
        const itemName = matches[1];
        const itemType = matches[2];
        button.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            await toggleActorEffect(actor, itemName, itemType); // have to await so that we geet updated status
            let messageString = createEffectString(actor, getProperty(message, "data.flags.detailed"));
            message.update({ "_id": message._id, "content": messageString });
        });
    }
    ;
    let actives = html.find(".active-effect-delete");
    for (let i = 0; i < actives.length; i++) {
        let active = actives[i];
        let id = active.id;
        active.addEventListener("click", async (ev) => {
            let token = canvas.tokens.get(message.data.speaker.token);
            let activeEffects = getProperty(token.actor.data, "flags.dynamiceffects.activeEffects") || [];
            activeEffects = activeEffects.filter(tem => tem.itemId !== id);
            await token.actor.update({ "flags.dynamiceffects.activeEffects": activeEffects }, {});
            let messageString = createEffectString(token.actor, getProperty(message, "data.flags.detailed"));
            message.update({ "_id": message._id, "content": messageString });
        });
    }
};
Hooks.on("renderChatMessage", activateHandler);
export let dynamiceffectsSetPassiveEffect = (itemName, setValue = false, itemType = "") => {
    const speaker = ChatMessage.getSpeaker();
    const token = canvas.tokens.get(speaker.token);
    if (!token) {
        ui.notifications.warn(`${game.i18n.localize("dynamiceffects.noSelection")}`);
        return;
    }
    return toggleActorEffect(token.actor, itemName, itemType, setValue);
};
export let dynamiceffectsTogglePassiveEffect = (itemName, itemType = "") => {
    const speaker = ChatMessage.getSpeaker();
    const token = canvas.tokens.get(speaker.token);
    if (!token) {
        ui.notifications.warn(`${game.i18n.localize("dynamiceffects.noSelection")}`);
        return;
    }
    return toggleActorEffect(token.actor, itemName, itemType, undefined);
};
/*
export let toggleTokenEffect = async (tokenId: string, itemName: string, itemType: String, overRide: boolean = undefined) => {
  if (!tokenId) return false;
  let token = canvas.tokens.get(tokenId);
  return toggleActorEffect(token.actor, itemName, itemType, overRide);
}
*/
export let toggleActorIdEffect = async (actorId, itemName, itemType = "", overRide = undefined) => {
    return toggleActorEffect(game.actors.get(actorId), itemName, itemType, overRide);
};
let toggleActorEffect = async (actor, itemName, itemType, overRide = undefined) => {
    if (!actor)
        return false;
    let consumeCharge = game.settings.get("dynamiceffects", "ConsumeCharge");
    const item = actor ? actor.items.find(i => i.name === itemName && (itemType === "" || itemType === i.data.type)) : null;
    if (!item) {
        ui.notifications.warn(`${game.i18n.localize("dynamiceffects.noeffect")} ${itemName}`);
        return false;
    }
    let useUpdate = {};
    let consumeUpdate = {};
    let newStatus;
    if (["class", "power", "feat"].includes(item.data.type)) {
        /*    if (!hasProperty(item.data, "flags.dynamiceffects.alwaysActive")) {
              console.log(`Dynamic Effects | item ${item.name} has no alwaysActive property can't toggle`)
              return false;
            }
            */
        newStatus = !item.data.flags.dynamiceffects.alwaysActive;
        if (overRide !== undefined) {
            newStatus = overRide;
        }
        useUpdate = { "_id": item.id, "flags.dynamiceffects.alwaysActive": newStatus };
    }
    else { // equip/unequip
        newStatus = !item.data.data.equipped;
        if (overRide !== undefined) {
            newStatus = overRide;
        }
        useUpdate = { "_id": item.id, "data.equipped": newStatus };
    }
    if (consumeCharge && newStatus && item.data.data.uses && item.data.data.uses.max > 0) {
        let oldCharges = item.data.data.uses.value;
        if (oldCharges < 1) {
            if (newStatus) { // no charges and inactive cant make it active
                ui.notifications.info(`${actor.name} ${item.name} ${game.i18n.localize("dynamiceffects.noCharges")}`);
                return false;
            }
        }
        consumeUpdate = { "data.uses.value": oldCharges - 1, "_id": item.id };
    }
    ui.notifications.info(`${actor.name} ${item.name} ${game.i18n.localize(newStatus ? "dynamiceffects.active" : "dynamiceffects.inactive")}`);
    let update = mergeObject(useUpdate, consumeUpdate);
    await actor.updateEmbeddedEntity("OwnedItem", update);
    if (aboutTimeInstalled && newStatus && item.data.data.duration) { //only if about-time installed
        // let secPerRound = game.settings.get("about-time", "seconds-per-round");
        let duration = validateDuration(item.data.data.duration);
        if (duration.value > 0) {
            let spec = {};
            spec[duration.units] = duration.value;
            //@ts-ignore
            game.Gametime.doIn(spec, window.DynamicEffects._toggleActorIdEffect, actor.id, itemName, item.type, false);
        }
    }
    return newStatus;
};
export let removeActiveEffectsToken = () => {
    if (!game.user.isGM)
        return;
    canvas.tokens.controlled.forEach(token => removeAllTokenEffects(token));
};
let tokenScene = (tokenName, sceneName) => {
    if (!sceneName) {
        //@ts-ignore
        for (let scene of game.scenes.entities) {
            let token = scene.data.tokens.find(t => t.name === tokenName);
            if (token) {
                return { scene, token };
            }
        }
    }
    else {
        //@ts-ignore
        let scene = game.scenes.entities.find(t => t.name === sceneName);
        if (scene) {
            let token = scene.data.tokens.find(t => t.name === tokenName);
            if (token) {
                return { scene, token };
            }
        }
    }
    return null;
};
export let moveToken = async (token, targetTokenName, xGridOffset = 0, yGridOffset = 0, targetSceneName = "") => {
    let target = tokenScene(targetTokenName, targetSceneName);
    if (!token) {
        console.log("Dynmaiceffects | moveToken: Token not found");
        return ("Token not found");
    }
    if (!target) {
        console.log("Dynamiceffects | moveToken: Target Not found");
        return `Token ${targetTokenName} not found`;
    }
    return await requestGMAction(GMAction.actions.recreateToken, { userId: game.user.id,
        startSceneId: canvas.scene.id,
        targetSceneId: target.scene.id, tokenData: token.data,
        x: target.token.x + xGridOffset * canvas.scene.data.grid,
        y: target.token.y + yGridOffset * canvas.scene.data.grid
    });
};
export let renameToken = async (token, newName) => {
    requestGMAction(GMAction.actions.renameToken, { userId: game.user.id, startSceneId: canvas.scene.id, tokenData: token.data, newName });
};
export let teleportToToken = async (token, targetTokenName, xGridOffset = 0, yGridOffset = 0, targetSceneName = "") => {
    let target = tokenScene(targetTokenName, targetSceneName);
    if (!token) {
        console.log("DynamicEffects| teleportToToken: Token not found");
        return ("Token not found");
    }
    if (!target) {
        console.log("DynamicEffects| teleportToToken: Target Not found");
        return `Token ${targetTokenName} not found`;
    }
    return teleport(token, target.scene, target.token.x + xGridOffset * target.scene.data.grid, target.token.y + yGridOffset * canvas.scene.data.grid);
};
export let teleport = async (token, targetScene, xpos, ypos) => {
    let x = parseInt(xpos);
    let y = parseInt(ypos);
    if (isNaN(x) || isNaN(y)) {
        console.log("DynamicEffects| teleport: Invalid co-ords", xpos, ypos);
        return `Invalid target co-ordinates (${xpos}, ${ypos})`;
    }
    if (!token) {
        console.warn("DynamicEffects| teleport: No Token");
        return "No active token";
    }
    // Hide the current token
    if (targetScene.name === canvas.scene.name) {
        //@ts-ignore
        CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);
        let sourceSceneId = canvas.scene.id;
        requestGMAction(GMAction.actions.recreateToken, { userId: game.user.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
        canvas.pan({ x: xpos, y: ypos });
        return true;
    }
    // deletes and recreates the token
    var sourceSceneId = canvas.scene.id;
    Hooks.once("canvasReady", async () => {
        await requestGMAction(GMAction.actions.createToken, { userId: game.user.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
        // canvas.pan({ x: xpos, y: ypos });
        await requestGMAction(GMAction.actions.deleteToken, { userId: game.user.id, startSceneId: sourceSceneId, targetSceneId: targetScene.id, tokenData: token.data, x: xpos, y: ypos });
    });
    // Need to stop animation since we are going to delete the token and if that happens before the animation completes we get an error
    //@ts-ignore
    CanvasAnimation.terminateAnimation(`Token.${token.id}.animateMovement`);
    return await targetScene.view();
};
export let setTokenVisibility = async (tokenId, visible) => {
    if (typeof tokenId !== "string")
        tokenId = tokenId.id;
    return requestGMAction(GMAction.actions.setTokenVisibility, { targetSceneId: canvas.scene.id, tokenId, hidden: !visible });
};
export let setTileVisibility = async (tileId, visible) => {
    if (typeof tileId !== "string")
        tileId = tileId.id;
    return requestGMAction(GMAction.actions.setTileVisibility, { targetSceneId: canvas.scene.id, tileId, hidden: !visible });
};
export let blindToken = async (tokenId) => {
    if (typeof tokenId !== "string")
        tokenId = tokenId.id;
    return requestGMAction(GMAction.actions.blindToken, { tokenId: tokenId, sceneId: canvas.scene.id });
};
export let restoreVision = async (tokenId) => {
    if (typeof tokenId !== "string")
        tokenId = tokenId.id;
    return requestGMAction(GMAction.actions.restoreVision, { tokenId: tokenId, sceneId: canvas.scene.id });
};
export let macroReadySetup = () => {
    //@ts-ignore
    let pcSheetNames = Object.values(CONFIG.Actor.sheetClasses.character).concat(Object.values(CONFIG.Actor.sheetClasses.npc))
        //@ts-ignore
        .map((sheetClass) => sheetClass.cls)
        .map((sheet) => sheet.name);
    console.log("Sheet names are ", pcSheetNames);
    pcSheetNames.forEach(sheetName => {
        Hooks.on("render" + sheetName, (app, html, data) => {
            // only for GMs or the owner of this character
            console.log("In add button ", app, data);
            if (!data.owner || !data.actor)
                return;
            _addEffects(app, html, data);
        });
    });
};
let _addEffects = (app, html, data) => {
    let openBtn = $(`<a class="open-de-effects" title="${"DEEffects"}"><i class="fas fa-clipboard"></i>${"Show DE"}</a>`);
    console.log("Open button called ", openBtn);
    openBtn.click(ev => {
        effectsActor(ev.shiftKey, { actor: app.object });
    });
    html.closest('.app').find('.open-de-effects').remove();
    let titleElement = html.closest('.app').find('.window-title');
    console.log("Title element ", titleElement);
    openBtn.insertAfter(titleElement);
};
