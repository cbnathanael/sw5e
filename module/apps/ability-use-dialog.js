/**
 * A specialized Dialog subclass for ability usage
 * @type {Dialog}
 */
export default class AbilityUseDialog extends Dialog {
  constructor(item, dialogData={}, options={}) {
    super(dialogData, options);
    this.options.classes = ["sw5e", "dialog"];

    /**
     * Store a reference to the Item entity being used
     * @type {Item5e}
     */
    this.item = item;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * A constructor function which displays the Power Cast Dialog app for a given Actor and Item.
   * Returns a Promise which resolves to the dialog FormData once the workflow has been completed.
   * @param {Item5e} item
   * @return {Promise}
   */
  static async create(item) {
    if ( !item.isOwned ) throw new Error("You cannot display an ability usage dialog for an unowned item");

    // Prepare data
    const actorData = item.actor.data.data;
    const itemData = item.data.data;
    const uses = itemData.uses || {};
    const quantity = itemData.quantity || 0;
    const recharge = itemData.recharge || {};
    const recharges = !!recharge.value;

    // Prepare dialog form data
    const data = {
      item: item.data,
      title: game.i18n.format("SW5E.AbilityUseHint", item.data),
      note: this._getAbilityUseNote(item.data, uses, recharge),
      hasLimitedUses: uses.max || recharges,
      canUse: recharges ? recharge.charged : (quantity > 0 && !uses.value) || uses.value > 0,
      hasPlaceableTemplate: game.user.can("TEMPLATE_CREATE") && item.hasAreaTarget,
      errors: []
    };
    if ( item.data.type === "power" ) this._getPowerData(actorData, itemData, data);

    // Render the ability usage template
    const html = await renderTemplate("systems/sw5e/templates/apps/ability-use.html", data);

    // Create the Dialog and return as a Promise
    const icon = data.hasPowerSlots ? "fa-magic" : "fa-fist-raised";
    const label = game.i18n.localize("SW5E.AbilityUse" + (data.hasPowerSlots ? "Cast" : "Use"));
    return new Promise((resolve) => {
      const dlg = new this(item, {
        title: `${item.name}: Usage Configuration`,
        content: html,
        buttons: {
          use: {
            icon: `<i class="fas ${icon}"></i>`,
            label: label,
            callback: html => resolve(new FormData(html[0].querySelector("form")))
          }
        },
        default: "use",
        close: () => resolve(null)
      });
      dlg.render(true);
    });
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Get dialog data related to limited power slots
   * @private
   */
  static _getPowerData(actorData, itemData, data) {

    // Determine whether the power may be up-cast
    const lvl = itemData.level;
    const canUpcast = (lvl > 0) && CONFIG.SW5E.powerUpcastModes.includes(itemData.preparation.mode);

    // Determine the levels which are feasible
    let lmax = 0;
    const powerLevels = Array.fromRange(10).reduce((arr, i) => {
      if ( i < lvl ) return arr;
      const label = CONFIG.SW5E.powerLevels[i];
      const l = actorData.powers["power"+i] || {max: 0, override: null};
      let max = parseInt(l.override || l.max || 0);
      let slots = Math.clamped(parseInt(l.value || 0), 0, max);
      if ( max > 0 ) lmax = i;
      arr.push({
        level: i,
        label: i > 0 ? game.i18n.format('SW5E.PowerLevelSlot', {level: label, n: slots}) : label,
        canCast: canUpcast && (max > 0),
        hasSlots: slots > 0
      });
      return arr;
    }, []).filter(sl => sl.level <= lmax);

    // If this character has pact slots, present them as an option for casting the power.
    const pact = actorData.powers.pact;
    if (pact.level >= lvl) {
      powerLevels.push({
        level: 'pact',
        label: `${game.i18n.format('SW5E.PowerLevelPact', {level: pact.level, n: pact.value})}`,
        canCast: canUpcast,
        hasSlots: pact.value > 0
      });
    }
    const canCast = powerLevels.some(l => l.hasSlots);

    // Return merged data
    data = mergeObject(data, { hasPowerSlots: true, canUpcast, powerLevels });
    if ( !canCast ) data.errors.push("SW5E.PowerCastNoSlots");
  }

  /* -------------------------------------------- */

  /**
   * Get the ability usage note that is displayed
   * @private
   */
  static _getAbilityUseNote(item, uses, recharge) {

    // Zero quantity
    const quantity = item.data.quantity;
    if ( quantity <= 0 ) return game.i18n.localize("SW5E.AbilityUseUnavailableHint");

    // Abilities which use Recharge
    if ( !!recharge.value ) {
      return game.i18n.format(recharge.charged ? "SW5E.AbilityUseChargedHint" : "SW5E.AbilityUseRechargeHint", {
        type: item.type,
      })
    }

    // Does not use any resource
    if ( !uses.per || !uses.max ) return "";

    // Consumables
    if ( item.type === "consumable" ) {
      let str = "SW5E.AbilityUseNormalHint";
      if ( uses.value > 1 ) str = "SW5E.AbilityUseConsumableChargeHint";
      else if ( item.data.quantity === 1 && uses.autoDestroy ) str = "SW5E.AbilityUseConsumableDestroyHint";
      else if ( item.data.quantity > 1 ) str = "SW5E.AbilityUseConsumableQuantityHint";
      return game.i18n.format(str, {
        type: item.data.consumableType,
        value: uses.value,
        quantity: item.data.quantity,
      });
    }

    // Other Items
    else {
      return game.i18n.format("SW5E.AbilityUseNormalHint", {
        type: item.type,
        value: uses.value,
        max: uses.max,
        per: CONFIG.SW5E.limitedUsePeriods[uses.per]
      });
    }
  }

  /* -------------------------------------------- */

  static _handleSubmit(formData, item) {

  }
}
