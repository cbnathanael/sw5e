import { activateItemEffectsForToken, activateItemEffectsForTargets, removeAllItemActiveEffectsTokenId, removeAllItemActiveEffectsActorId, removeAllItemActiveEffectsTargets } from "./dynamiceffects.js";
export class GMActionMessage {
    constructor(action, sender, targetGM, data) {
        this.action = action;
        this.sender = sender;
        this.targetGM = targetGM;
        this.data = data;
    }
}
export let requestGMAction = async (action, data, debugLog = false) => {
    if (game.user.isGM) {
        //@ts-ignore
        return await DynamicEffects.GMAction.processAction(action, game.user.id, duplicate(data));
    }
    //@ts-ignore
    let intendedGM = game.users.entities.find(u => u.isGM && u.active);
    //@ts-ignore
    // if (!game.user.isTrusted) return;
    if (!intendedGM) {
        ui.notifications.error(`${game.user.name} ${game.i18n.localize("dynamiceffects.noGM")}`);
        console.error("dynamiceffects | No GM user connected - cannot do request ", action, data);
        return;
    }
    //@ts-ignore
    let message = new DynamicEffects.GMActionMessage(action, game.user.id, intendedGM.id, data);
    if (debugLog)
        console.log("About to send message", message);
    //@ts-ignore
    game.socket.emit(DynamicEffects.GMAction._moduleSocket, message, resp => {
        if (debugLog)
            console.log("message sent");
    });
};
export class GMAction {
    static _setupSocket() {
        //@ts-ignore
        game.socket.on(this._moduleSocket, async (message) => {
            if (game.user.id !== message.targetGM)
                return;
            if (!game.user.isGM)
                return;
            return this.processAction(message.action, message.sender, message.data);
        });
    }
    static initActions() {
    }
    static setupActions() {
    }
    static readyActions() {
        this._setupSocket();
        requestGMAction("testMessage", game.user.name);
    }
    static async processAction(action, userId, data) {
        this.processSingleAction(action, userId, data);
    }
    static async processActionQueue() {
        console.log("Processing action queue");
        this.processingActions = this.actionQueue.length > 0;
        while (this.processingActions) {
            console.log("Processing Actions ", this.actionQueue.length);
            let { action, userId, data } = this.actionQueue[0];
            console.log("Processing actions ", action, userId, data);
            await this.processSingleAction(action, userId, data);
            this.actionQueue = this.actionQueue.slice(1);
            this.processingActions = this.actionQueue.length > 0;
        }
    }
    static async processSingleAction(action, userId, data) {
        var actorId;
        //@ts-ignore
        let itemData = data.itemData;
        //@ts-ignore
        var tokenId = data.tokenId;
        var targetList;
        //@ts-ignore
        var requester = userId;
        //@ts-ignore
        var actorId = data.actorId;
        var scene;
        switch (action) {
            case "testMessage":
                console.log("DyamicEffects | test message received", data);
                return "Test message received and processed";
                break;
            case this.actions.setTokenVisibility:
                //@ts-ignore
                await setTokenVisibility(requester, data);
                break;
            case this.actions.setTileVisibility:
                //@ts-ignore
                await setTileVisibility(requester, data);
                break;
            case "activateItemEffectsForTargets":
                //@ts-ignore
                targetList = data.targetList;
                //@ts-ignore
                await activateItemEffectsForTargets(false, targetList, itemData, data.context, data.powerLevel);
                //@ts-ignore
                this.chatEffects(requester, actorId, itemData, targetList, game.i18n.localize("dynamiceffects.applyingEffects"), data.whisper);
                break;
            case this.actions.activateItemEffectsForToken:
                //@ts-ignore
                tokenId = data.tokenId;
                //@ts-ignore
                await activateItemEffectsForToken(false, tokenId, itemData, data.context, data.powerLevel);
                //@ts-ignore
                this.chatEffects(requester, actorId, itemData, [tokenId], game.i18n.localize("dynamiceffects.applyingEffects"), data.whisper);
                break;
            case this.actions.activateItemEffectsForActor:
                //@ts-ignore
                await activateItemEffectsForActor(false, data.actorId, data.itemData);
                break;
            case this.actions.removeAllItemActiveEffectsTokenId:
                //@ts-ignore
                tokenId = data.tokenId;
                await removeAllItemActiveEffectsTokenId(tokenId, itemData);
                //@ts-ignore
                this.chatEffects(requester, actorId, itemData, [tokenId], game.i18n.localize("dynamiceffects.removingEffects"), data.whisper);
                break;
            case this.actions.removeAllItemActiveEffectsActorId:
                //@ts-ignore
                await removeAllItemActiveEffectsActorId(data.actorId, data.itemData);
                break;
            case this.actions.removeAllItemActiveEffectsTargets:
                //@ts-ignore
                targetList = data.targetList;
                await removeAllItemActiveEffectsTargets(targetList, itemData);
                //@ts-ignore
                this.chatEffects(requester, actorId, itemData, targetList, game.i18n.localize("dynamiceffects.removingEffects"), data.whisper);
                break;
            case this.actions.recreateToken:
                //@ts-ignore
                await recreateToken(requester, data);
                break;
            case this.actions.createToken:
                //@ts-ignore
                await createToken(requester, data);
                break;
            case this.actions.deleteToken:
                //@ts-ignore
                await deleteToken(requester, data);
                break;
            case this.actions.blindToken:
                //@ts-ignore
                scene = game.scenes.get(data.sceneId);
                await scene.updateEmbeddedEntity("Token", { "_id": tokenId, vision: false });
                break;
            case this.actions.restoreVision:
                //@ts-ignore
                scene = game.scenes.get(data.sceneId);
                await scene.updateEmbeddedEntity("Token", { "_id": tokenId, vision: true });
                break;
            case this.actions.renameToken:
                //@ts-ignore
                canvas.tokens.placeables.find(t => t.id === data.tokenData._id).update({ "name": data.newName });
                break;
            case this.actions.applyTokenMagic:
                //@ts-ignore
                await applyTokenMagic(data.tokenId, data.effectId);
                break;
            case this.actions.deleteTokenMagic:
                //@ts-ignore
                await deleteTokenMagic(data.tokenId, data.effectId);
                break;
            default:
                console.warn("dynamiceffects invalid message received", action, data);
        }
    }
}
GMAction.actions = {
    test: "testMessage",
    activateItemEffectsForActor: "activateItemEffectsForActor",
    activateItemEffectsForToken: "activateItemEffectsForToken",
    activateItemEffectsForTargets: "activateItemEffectsForTargets",
    removeAllItemActiveEffectsActorId: "removeAllItemActiveEffectsActorId",
    removeAllItemActiveEffectsTokenId: "removeAllItemActiveEffectsTokenId",
    removeAllItemActiveEffectsTargets: "removeAllItemActiveEffectsTargets",
    setTokenVisibility: "setTokenVisibility",
    setTileVisibility: "setTileVisibility",
    blindToken: "blindToken",
    restoreVision: "restoreVision",
    recreateToken: "recreateToken",
    createToken: "createToken",
    deleteToken: "deleteToken",
    renameToken: "renameToken",
    moveToken: "moveToken",
    applyTokenMagic: "applyTokenMagic",
    deleteTokenMagic: "deleteTokenMagic"
};
GMAction.actionQueue = [];
GMAction.processingActions = false;
GMAction._moduleSocket = "module.dynamiceffects";
GMAction.chatEffects = (userId, actorId, itemData, tokenList, flavor, whisper) => {
    let names = tokenList.filter(tid => canvas.tokens.get(tid)).map(tid => canvas.tokens.get(tid).name);
    if (names.length > 0) {
        let chatData = {
            user: game.users.get(userId),
            speaker: { actor: game.actors.get(actorId) },
            content: `${flavor} (${itemData.name}): ${names}`,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            flags: {}
        };
        //@ts-ignore
        if (whisper)
            chatData.whisper = ChatMessage.getWhisperRecipients("GM");
        ChatMessage.create(chatData);
    }
};
// delete a token from the specified scene and recreate it on the target scene.
let recreateToken = async (userId, data) => {
    createToken(userId, data);
    deleteToken(userId, data);
    return;
};
// delete a token from the specified scene and recreate it on the target scene.
let deleteToken = async (userId, data) => {
    //@ts-ignore
    let scenes = game.scenes;
    let startScene = scenes.get(data.startSceneId);
    //@ts-ignore
    await startScene.deleteEmbeddedEntity("Token", data.tokenData._id);
};
// delete a token from the specified scene and recreate it on the target scene.
let createToken = async (userId, data) => {
    //@ts-ignore
    let scenes = game.scenes;
    let targetScene = scenes.get(data.targetSceneId);
    return await targetScene.createEmbeddedEntity('Token', mergeObject(duplicate(data.tokenData), { "x": data.x, "y": data.y, hidden: false }, { overwrite: true, inplace: true }));
};
//Set the hidden status for a token.
let setTokenVisibility = async (userId, data) => {
    if (!data.targetSceneId || !data.tokenId)
        return;
    //@ts-ignore
    let scene = game.scenes.get(data.targetSceneId);
    await scene.updateEmbeddedEntity("Token", { "_id": data.tokenId, "hidden": data.hidden });
    return "token visibility complete";
};
// Set the hidden staturs for a tile
let setTileVisibility = async (userId, data) => {
    if (!data.targetSceneId || !data.tileId)
        return;
    //@ts-ignore
    let scene = game.scenes.get(data.targetSceneId);
    return await scene.updateEmbeddedEntity("Tile", { "_id": data.tileId, "hidden": data.hidden });
};
let applyTokenMagic = async (tokenId, effectId) => {
    let token = canvas.tokens.get(tokenId);
    //@ts-ignore
    let tokenMagic = window.TokenMagic;
    if (tokenMagic && token) {
        tokenMagic.addFilters(token, effectId);
    }
    else {
        console.log(`Dynamiceffects | Something went wrong with finding effect ${effectId}`);
    }
};
let deleteTokenMagic = async (tokenId, effectId) => {
    //@ts-ignore
    let tokenMagic = window.TokenMagic;
    let token = canvas.tokens.get(tokenId);
    console.warn("delete token magic effects ", token, tokenMagic);
    if (tokenMagic && token)
        tokenMagic === null || tokenMagic === void 0 ? void 0 : tokenMagic.deleteFilters(token, effectId);
};
