import ActorSheetFlags from "../../../systems/dnd5e/module/apps/actor-flags.js";

class myActorSheetFlags extends ActorSheetFlags {
  async _updateObject(event, formData) {
    const actor = this.object;
    const updateData = expandObject(formData);

    // Unset any flags which are "false"
    let unset = false;
    const flags = updateData.flags.dnd5e;
    for ( let [k, v] of Object.entries(flags) ) {
      if ( [undefined, null, "", false, 0].includes(v) ) {
        delete flags[k];
        if ( hasProperty(actor.data.flags, `dnd5e.${k}`) ) {
          unset = true;
          flags[`-=${k}`] = null;
        }
      }
    }
    // Apply the changes
    await actor.update(updateData, {diff: true});
  }
}

Hooks.once("ready", () => {
  if (game.system.id === "dnd5e") {
    console.log("Dynamiceffects | Patching actor-flags")
    let updateProxy = new Proxy( ActorSheetFlags.prototype._updateObject, {
      apply: (target, thisValue, args) =>
          myActorSheetFlags.prototype._updateObject.bind(thisValue)(...args)
    })
    ActorSheetFlags.prototype._updateObject = updateProxy;
  }
})