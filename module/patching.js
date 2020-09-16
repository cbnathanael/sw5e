function restrictVisibility() {
    console.log("IN my restrict visibility");
    // Tokens
    for (let t of canvas.tokens.placeables) {
        //@ts-ignore
        t.visible = (!this.tokenVision && !t.data.hidden) || t.isVisible || t.actor.hasPerm(game.user, "OWNER");
    }
    // Door Icons
    for (let d of canvas.controls.doors.children) {
        d.visible = !this.tokenVision || d.isVisible;
    }
}
function isVisible() {
    var _a;
    const gm = game.user.isGM;
    if ((_a = this.actor) === null || _a === void 0 ? void 0 : _a.hasPerm(game.user, "OWNER"))
        return true;
    if (this.data.hidden)
        return gm;
    if (!canvas.sight.tokenVision)
        return true;
    if (this._controlled)
        return true;
    return canvas.sight.testVisibility(this.center, { tolerance: canvas.dimensions.size / 4 });
}
function updateToken(token, { defer = false, deleted = false, walls = null, forceUpdateFog = false } = {}) {
    var _a, _b;
    let sourceId = `Token.${token.id}`;
    this.sources.vision.delete(sourceId);
    this.sources.lights.delete(sourceId);
    if (deleted)
        return defer ? null : this.update();
    if (token.data.hidden && !(game.user.isGM || ((_a = token.actor) === null || _a === void 0 ? void 0 : _a.hasPerm(game.user, "OWNER"))))
        return; // token.owner)) return;
    // Vision is displayed if the token is controlled, or if it is observed by a player with no tokens controlled
    let displayVision = token._controlled;
    if (!displayVision && !game.user.isGM && !canvas.tokens.controlled.length) {
        displayVision = (_b = token.actor) === null || _b === void 0 ? void 0 : _b.hasPerm(game.user, "OBSERVER");
    }
    // Take no action for Tokens which are invisible or Tokens that have no sight or light
    const globalLight = canvas.scene.data.globalLight;
    let isVisionSource = token.hasSight && displayVision; // this.tokenVision && token.hasSight && displayVision;
    let isLightSource = token.emitsLight;
    // If the Token is no longer a source, we don't need further work
    if (!isVisionSource && !isLightSource)
        return;
    // Prepare some common data
    const center = token.getSightOrigin();
    const maxR = globalLight ? Math.max(canvas.dimensions.width, canvas.dimensions.height) : null;
    let [cullMult, cullMin, cullMax] = this._cull;
    if (globalLight)
        cullMin = maxR;
    // Prepare vision sources
    if (isVisionSource) {
        // Compute vision polygons
        let dim = globalLight ? 0 : token.getLightRadius(token.data.dimSight);
        const bright = globalLight ? maxR : token.getLightRadius(token.data.brightSight);
        if ((dim === 0) && (bright === 0))
            dim = canvas.dimensions.size * 0.6;
        const radius = Math.max(Math.abs(dim), Math.abs(bright));
        const { los, fov } = this.constructor.computeSight(center, radius, {
            angle: token.data.sightAngle,
            cullMult: cullMult,
            cullMin: cullMin,
            cullMax: cullMax,
            density: 6,
            rotation: token.data.rotation,
            walls: walls
        });
        // Add a vision source
        //@ts-ignore
        const source = new SightLayerSource({
            x: center.x,
            y: center.y,
            los: los,
            fov: fov,
            dim: dim,
            bright: bright
        });
        this.sources.vision.set(sourceId, source);
        // Update fog exploration for the token position
        this.updateFog(center.x, center.y, Math.max(dim, bright), token.data.sightAngle !== 360, forceUpdateFog);
    }
    // Prepare light sources
    if (isLightSource) {
        // Compute light emission polygons
        const dim = token.getLightRadius(token.data.dimLight);
        const bright = token.getLightRadius(token.data.brightLight);
        const radius = Math.max(Math.abs(dim), Math.abs(bright));
        const { fov } = this.constructor.computeSight(center, radius, {
            angle: token.data.lightAngle,
            cullMult: cullMult,
            cullMin: cullMin,
            cullMax: cullMax,
            density: 6,
            rotation: token.data.rotation,
            walls: walls
        });
        // Add a light source
        //@ts-ignore
        const source = new SightLayerSource({
            x: center.x,
            y: center.y,
            los: null,
            fov: fov,
            dim: dim,
            bright: bright,
            color: token.data.lightColor,
            alpha: token.data.lightAlpha
        });
        this.sources.lights.set(sourceId, source);
    }
    // Maybe update
    if (CONFIG.debug.sight)
        console.debug(`Updated SightLayer source for ${sourceId}`);
    if (!defer)
        this.update();
}
function rollAbilitySave(abilityId, options = {}) {
    const label = CONFIG.SW5E.abilities[abilityId];
    const abl = this.data.data.abilities[abilityId];
    const parts = ["@save"];
    const data = { save: abl.save };
    // Include a global actor ability save bonus - if it is numberic it has already been included
    const actorBonus = getProperty(this.data.data.bonuses, "abilities.save");
    //@ts-ignore
    if (!!actorBonus && !Number.isNumeric(actorBonus)) {
        parts.push("@saveBonus");
        //@ts-ignore
        data.saveBonus = actorBonus;
    }
    // Roll and return
    //@ts-ignore
    return game.sw5e.dice.d20Roll(mergeObject(options, {
        parts: parts,
        data: data,
        //@ts-ignore
        title: game.i18n.format("SW5E.SavePromptTitle", { ability: label }),
        speaker: ChatMessage.getSpeaker({ actor: this }),
        halflingLucky: this.getFlag("sw5e", "halflingLucky")
    }));
}
function getPowerDC(ability) {
    const actorData = this.data.data;
    const bonus = parseInt(new Roll(`${getProperty(actorData, "bonuses.power.dc")}` || "0", this.getRollData()).roll().total);
    ability = actorData.abilities[ability];
    const prof = actorData.attributes.prof;
    return 8 + (ability ? ability.mod : 0) + prof + bonus;
}
function Roll_replaceData(replaced, formula) {
    let dataRgx = new RegExp(/@([a-z.\-_0-9]+)/gi);
    return formula.replace(dataRgx, (match, term) => {
        const currentBranch = new Set(replaced);
        if (currentBranch.has(term)) {
            console.error(`infinite loop on term ${term}`);
            throw Error(`infinite loop on term ${term}`);
        }
        currentBranch.add(term);
        let value = getProperty(this.data, term);
        if (typeof (value) === "string" && value.indexOf("@") !== -1) {
            // has more replacements
            // new set to allow replace same term on different branches
            value = Roll_replaceData.bind(this)(new Set(currentBranch), value);
        }
        return value ? String(value).trim() : "0";
    });
}
Hooks.once("init", () => {
    var _a, _b;
    if (["0.5.4", "0.5.5", "0.5.6", "0.5.7", "0.6.0", "0.6.1", "0.6.2", "0.6.3", "0.6.4", "0.6.5", "0.7.0"].includes(game.data.version)) {
        if (game.settings.get("dynamiceffects", "playerControlsInvisibleTokens")) { // moved this to setup so it get installed before the first round of calcs.
            console.log("Dynamiceffects | Patching Token.isVisible");
            Object.defineProperty(Token.prototype, "isVisible", { get: isVisible });
            //@ts-ignore
            if (true || !((_a = game.modules.get("wall-height")) === null || _a === void 0 ? void 0 : _a.active) || !isNewerVersion((_b = game.modules.get("wall-height")) === null || _b === void 0 ? void 0 : _b.data.version, "1.0.3")) {
                console.log("Dynamiceffects | Patching Sightlayer.updateToken");
                //@ts-ignore
                let updateTokenProxy = new Proxy(SightLayer.prototype.updateToken, {
                    apply: (target, thisvalue, args) => updateToken.bind(thisvalue)(...args)
                });
                //@ts-ignore
                SightLayer.prototype.updateToken = updateTokenProxy;
            }
            else {
                console.log("Dynamiceffects | Not Patching Sightlayer.updateToken - leaving to wall-height");
            }
            /* not required with the change to isvisible.
            console.log("Dynamiceffects | Patching SightLayer.restrictVisibility")
            //@ts-ignore
            let restrictVisibilityProxy = new Proxy(SightLayer.prototype.restrictVisibility, {
              apply: (target, thisvalue, args) =>
                  restrictVisibility.bind(thisvalue)(...args)
            })
            //@ts-ignore
            SightLayer.prototype.restrictVisibility = restrictVisibilityProxy;
            */
        }
    }
});
Hooks.once("ready", () => {
    var _a, _b;
    if (game.system.id === "sw5e") {
        //@ts-ignore
        if ((_b = (_a = game.sw5e) === null || _a === void 0 ? void 0 : _a.dice) === null || _b === void 0 ? void 0 : _b.d20Roll) {
            console.log("Dynamiceffects | Patching Actor5e.rollAbilitySave");
            let rollAbilitySaveProxy = new Proxy(CONFIG.Actor.entityClass.prototype.rollAbilitySave, {
                apply: (target, thisvalue, args) => rollAbilitySave.bind(thisvalue)(...args)
            });
            CONFIG.Actor.entityClass.prototype.rollAbilitySave = rollAbilitySaveProxy;
        }
        else {
            console.warn("Dynamiceffects | Error when patching Actor5e.rollAbilitySave");
        }
    }
    if (["0.7.0"].includes(game.data.version)) {
        console.log("Dynamiceffects | Patching Roll._replaceFormulaData v0.7.0");
        //@ts-ignore
        Roll.prototype._replaceFormulaData = new Proxy(Roll.prototype._replaceFormulaData, {
            //@ts-ignore
            apply: (target, thisvalue, args) => Roll_replaceData.bind(thisvalue)(new Set(), ...args)
        });
    }
    else {
        console.log("Dynamiceffects | Patching Roll._replaceData v0.6.5 and earlier");
        Roll.prototype._replaceData = new Proxy(Roll.prototype._replaceData, {
            //@ts-ignore
            apply: (target, thisvalue, args) => Roll_replaceData.bind(thisvalue)(new Set(), ...args)
        });
    }
});
