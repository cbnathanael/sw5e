import Item5e from "../../item/entity.js";
import TraitSelector from "../../apps/trait-selector.js";
import ActorSheetFlags from "../../apps/actor-flags.js";
import {SW5E} from '../../config.js';

/**
 * Extend the basic ActorSheet class to do all the SW5e things!
 * This sheet is an Abstract layer which is not used.
 * @extends {ActorSheet}
 */
export default class ActorSheet5e extends ActorSheet {
  constructor(...args) {
    super(...args);

    /**
     * Track the set of item filters which are applied
     * @type {Set}
     */
    this._filters = {
      inventory: new Set(),
      powerbook: new Set(),
      features: new Set(),
      effects: new Set()
    };
  }

  /* -------------------------------------------- */

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      scrollY: [
        ".inventory .inventory-list",
        ".features .inventory-list",
        ".powerbook .inventory-list",
        ".effects .inventory-list"
      ],
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "description"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get template() {
    if ( !game.user.isGM && this.actor.limited ) return "systems/sw5e/templates/actors/oldActor/limited-sheet.html";
    return `systems/sw5e/templates/actors/oldActor/${this.actor.data.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {

    // Basic data
    let isOwner = this.entity.owner;
    const data = {
      owner: isOwner,
      limited: this.entity.limited,
      options: this.options,
      editable: this.isEditable,
      cssClass: isOwner ? "editable" : "locked",
      isCharacter: this.entity.data.type === "character",
      isNPC: this.entity.data.type === "npc",
      isVehicle: this.entity.data.type === 'vehicle',
      config: CONFIG.SW5E,
    };

    // The Actor and its Items
    data.actor = duplicate(this.actor.data);
    data.items = this.actor.items.map(i => {
      i.data.labels = i.labels;
      return i.data;
    });
    data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    data.data = data.actor.data;
    data.labels = this.actor.labels || {};
    data.filters = this._filters;

    // Ability Scores
    for ( let [a, abl] of Object.entries(data.actor.data.abilities)) {
      abl.icon = this._getProficiencyIcon(abl.proficient);
      abl.hover = CONFIG.SW5E.proficiencyLevels[abl.proficient];
      abl.label = CONFIG.SW5E.abilities[a];
    }

    // Skills
    if (data.actor.data.skills) {
      for ( let [s, skl] of Object.entries(data.actor.data.skills)) {
        skl.ability = CONFIG.SW5E.abilityAbbreviations[skl.ability];
        skl.icon = this._getProficiencyIcon(skl.value);
        skl.hover = CONFIG.SW5E.proficiencyLevels[skl.value];
        skl.label = CONFIG.SW5E.skills[s];
      }
    }

    // Update traits
    this._prepareTraits(data.actor.data.traits);

    // Prepare owned items
    this._prepareItems(data);

    // Prepare active effects
	this._prepareEffects(data);

    // Return data to the sheet
    return data
  }

  /* -------------------------------------------- */

  /**
   * Prepare the data structure for traits data like languages, resistances & vulnerabilities, and proficiencies
   * @param {object} traits   The raw traits data object from the actor data
   * @private
   */
  _prepareTraits(traits) {
    const map = {
      "dr": CONFIG.SW5E.damageResistanceTypes,
      "di": CONFIG.SW5E.damageResistanceTypes,
      "dv": CONFIG.SW5E.damageResistanceTypes,
      "ci": CONFIG.SW5E.conditionTypes,
      "languages": CONFIG.SW5E.languages,
      "armorProf": CONFIG.SW5E.armorProficiencies,
      "weaponProf": CONFIG.SW5E.weaponProficiencies,
      "toolProf": CONFIG.SW5E.toolProficiencies
    };
    for ( let [t, choices] of Object.entries(map) ) {
      const trait = traits[t];
      if ( !trait ) continue;
      let values = [];
      if ( trait.value ) {
        values = trait.value instanceof Array ? trait.value : [trait.value];
      }
      trait.selected = values.reduce((obj, t) => {
        obj[t] = choices[t];
        return obj;
      }, {});

      // Add custom entry
      if ( trait.custom ) {
        trait.custom.split(";").forEach((c, i) => trait.selected[`custom${i+1}`] = c.trim());
      }
      trait.cssClass = !isObjectEmpty(trait.selected) ? "" : "inactive";
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare the data structure for Active Effects which are currently applied to the Actor.
   * @param {object} data       The object of rendering data which is being prepared
   * @private
   */
  _prepareEffects(data) {

    // Define effect header categories
    const categories = {
      temporary: {
        label: "Temporary Effects",
        effects: []
      },
      passive: {
        label: "Passive Effects",
        effects: []
      },
      inactive: {
        label: "Inactive Effects",
        effects: []
      }
    };

    // Iterate over active effects, classifying them into categories
    for ( let e of this.actor.effects ) {
      e._getSourceName(); // Trigger a lookup for the source name
      if ( e.data.disabled ) categories.inactive.effects.push(e);
      else if ( e.isTemporary ) categories.temporary.effects.push(e);
      else categories.passive.effects.push(e);
    }

    // Add the prepared categories of effects to the rendering data
    return data.effects = categories;
  }

  /* -------------------------------------------- */

  /**
   * Insert a power into the powerbook object when rendering the character sheet
   * @param {Object} data     The Actor data being prepared
   * @param {Array} powers    The power data being prepared
   * @private
   */
  _preparePowerbook(data, powers) {
    const owner = this.actor.owner;
    const levels = data.data.powers;
    const powerbook = {};

    // Define some mappings
    const sections = {
      "atwill": -20,
      "innate": -10,
      "pact": 0.5
    };

    // Label power slot uses headers
    const useLabels = {
      "-20": "-",
      "-10": "-",
      "0": "&infin;"
    };

    // Format a powerbook entry for a certain indexed level
    const registerSection = (sl, i, label, {prepMode="prepared", value, max, override}={}) => {
      powerbook[i] = {
        order: i,
        label: label,
        usesSlots: i > 0,
        canCreate: owner,
        canPrepare: (data.actor.type === "character") && (i >= 1),
        powers: [],
        uses: useLabels[i] || value || 0,
        slots: useLabels[i] || max || 0,
        override: override || 0,
        dataset: {"type": "power", "level": prepMode in sections ? 1 : i, "preparation.mode": prepMode},
        prop: sl
      };
    };

    // Determine the maximum power level which has a slot
    const maxLevel = Array.fromRange(10).reduce((max, i) => {
      if ( i === 0 ) return max;
      const level = levels[`power${i}`];
      if ( (level.max || level.override ) && ( i > max ) ) max = i;
      return max;
    }, 0);

    // Level-based powercasters have cantrips and leveled slots
    if ( maxLevel > 0 ) {
      registerSection("power0", 0, CONFIG.SW5E.powerLevels[0]);
      for (let lvl = 1; lvl <= maxLevel; lvl++) {
        const sl = `power${lvl}`;
        registerSection(sl, lvl, CONFIG.SW5E.powerLevels[lvl], levels[sl]);
      }
    }
    
    // Pact magic users have cantrips and a pact magic section
    if ( levels.pact && levels.pact.max ) {
      if ( !powerbook["0"] ) registerSection("power0", 0, CONFIG.SW5E.powerLevels[0]);
      const l = levels.pact;
      const config = CONFIG.SW5E.powerPreparationModes.pact;
      registerSection("pact", sections.pact, config, {
        prepMode: "pact",
        value: l.value,
        max: l.max,
        override: l.override
      });
    }

    // Iterate over every power item, adding powers to the powerbook by section
    powers.forEach(power => {
      const mode = power.data.preparation.mode || "prepared";
      let s = power.data.level || 0;
      const sl = `power${s}`;

      // Specialized powercasting modes (if they exist)
      if ( mode in sections ) {
        s = sections[mode];
        if ( !powerbook[s] ){
          const l = levels[mode] || {};
          const config = CONFIG.SW5E.powerPreparationModes[mode];
          registerSection(mode, s, config, {
            prepMode: mode,
            value: l.value,
            max: l.max,
            override: l.override
          });
        }
      }

      // Sections for higher-level powers which the caster "should not" have, but power items exist for
      else if ( !powerbook[s] ) {
        registerSection(sl, s, CONFIG.SW5E.powerLevels[s], {levels: levels[sl]});
      }

      // Add the power to the relevant heading
      powerbook[s].powers.push(power);
    });

    // Sort the powerbook by section level
    const sorted = Object.values(powerbook);
    sorted.sort((a, b) => a.order - b.order);
    return sorted;
  }

  /* -------------------------------------------- */

  /**
   * Determine whether an Owned Item will be shown based on the current set of filters
   * @return {boolean}
   * @private
   */
  _filterItems(items, filters) {
    return items.filter(item => {
      const data = item.data;

      // Action usage
      for ( let f of ["action", "bonus", "reaction"] ) {
        if ( filters.has(f) ) {
          if ((data.activation && (data.activation.type !== f))) return false;
        }
      }

      // Power-specific filters
      if ( filters.has("ritual") ) {
        if (data.components.ritual !== true) return false;
      }
      if ( filters.has("concentration") ) {
        if (data.components.concentration !== true) return false;
      }
      if ( filters.has("prepared") ) {
        if ( data.level === 0 || ["innate", "always"].includes(data.preparation.mode) ) return true;
        if ( this.actor.data.type === "npc" ) return true;
        return data.preparation.prepared;
      }

      // Equipment-specific filters
      if ( filters.has("equipped") ) {
        if ( data.equipped !== true ) return false;
      }
      return true;
    });
  }

  /* -------------------------------------------- */

  /**
   * Get the font-awesome icon used to display a certain level of skill proficiency
   * @private
   */
  _getProficiencyIcon(level) {
    const icons = {
      0: '<i class="far fa-circle"></i>',
      0.5: '<i class="fas fa-adjust"></i>',
      1: '<i class="fas fa-check"></i>',
      2: '<i class="fas fa-check-double"></i>'
    };
    return icons[level];
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {

    // Activate Item Filters
    const filterLists = html.find(".filter-list");
    filterLists.each(this._initializeFilterItemList.bind(this));
    filterLists.on("click", ".filter-item", this._onToggleFilter.bind(this));

    // Item summaries
    html.find('.item .item-name h4').click(event => this._onItemSummary(event));

    // Editable Only Listeners
    if ( this.isEditable ) {

      // Input focus and update
      const inputs = html.find("input");
      inputs.focus(ev => ev.currentTarget.select());
      inputs.addBack().find('[data-dtype="Number"]').change(this._onChangeInputDelta.bind(this));

      // Ability Proficiency
      html.find('.ability-proficiency').click(this._onToggleAbilityProficiency.bind(this));

      // Toggle Skill Proficiency
      html.find('.skill-proficiency').on("click contextmenu", this._onCycleSkillProficiency.bind(this));

      // Trait Selector
      html.find('.trait-selector').click(this._onTraitSelector.bind(this));

      // Configure Special Flags
      html.find('.configure-flags').click(this._onConfigureFlags.bind(this));

      // Owned Item management
      html.find('.item-create').click(this._onItemCreate.bind(this));
      html.find('.item-edit').click(this._onItemEdit.bind(this));
      html.find('.item-delete').click(this._onItemDelete.bind(this));
      html.find('.item-uses input').click(ev => ev.target.select()).change(this._onUsesChange.bind(this));
      html.find('.slot-max-override').click(this._onPowerSlotOverride.bind(this));

      // Active Effect management
      html.find(".effect-control").click(this._onManageActiveEffect.bind(this));

    }

    // Owner Only Listeners
    if ( this.actor.owner ) {

      // Ability Checks
      html.find('.ability-name').click(this._onRollAbilityTest.bind(this));


      // Roll Skill Checks
      html.find('.skill-name').click(this._onRollSkillCheck.bind(this));

      // Item Rolling
      html.find('.item .item-image').click(event => this._onItemRoll(event));
      html.find('.item .item-recharge').click(event => this._onItemRecharge(event));
    }

    // Otherwise remove rollable classes
    else {
      html.find(".rollable").each((i, el) => el.classList.remove("rollable"));
    }

    // Handle default listeners last so system listeners are triggered first
    super.activateListeners(html);
  }

  /* -------------------------------------------- */

  /**
   * Iinitialize Item list filters by activating the set of filters which are currently applied
   * @private
   */
  _initializeFilterItemList(i, ul) {
    const set = this._filters[ul.dataset.filter];
    const filters = ul.querySelectorAll(".filter-item");
    for ( let li of filters ) {
      if ( set.has(li.dataset.filter) ) li.classList.add("active");
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle input changes to numeric form fields, allowing them to accept delta-typed inputs
   * @param event
   * @private
   */
  _onChangeInputDelta(event) {
    const input = event.target;
    const value = input.value;
    if ( ["+", "-"].includes(value[0]) ) {
      let delta = parseFloat(value);
      input.value = getProperty(this.actor.data, input.name) + delta;
    } else if ( value[0] === "=" ) {
      input.value = value.slice(1);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle click events for the Traits tab button to configure special Character Flags
   */
  _onConfigureFlags(event) {
    event.preventDefault();
    new ActorSheetFlags(this.actor).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle cycling proficiency in a Skill
   * @param {Event} event   A click or contextmenu event which triggered the handler
   * @private
   */
  _onCycleSkillProficiency(event) {
    event.preventDefault();
    const field = $(event.currentTarget).siblings('input[type="hidden"]');

    // Get the current level and the array of levels
    const level = parseFloat(field.val());
    const levels = [0, 1, 0.5, 2];
    let idx = levels.indexOf(level);

    // Toggle next level - forward on click, backwards on right
    if ( event.type === "click" ) {
      field.val(levels[(idx === levels.length - 1) ? 0 : idx + 1]);
    } else if ( event.type === "contextmenu" ) {
      field.val(levels[(idx === 0) ? levels.length - 1 : idx - 1]);
    }

    // Update the field value and save the form
    this._onSubmit(event);
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropActor(event, data) {
    const canPolymorph = game.user.isGM || (this.actor.owner && game.settings.get('sw5e', 'allowPolymorphing'));
    if ( !canPolymorph ) return false;

    // Get the target actor
    let sourceActor = null;
    if (data.pack) {
      const pack = game.packs.find(p => p.collection === data.pack);
      sourceActor = await pack.getEntity(data.id);
    } else {
      sourceActor = game.actors.get(data.id);
    }
    if ( !sourceActor ) return;

    // Define a function to record polymorph settings for future use
    const rememberOptions = html => {
      const options = {};
      html.find('input').each((i, el) => {
        options[el.name] = el.checked;
      });
      const settings = mergeObject(game.settings.get('sw5e', 'polymorphSettings') || {}, options);
      game.settings.set('sw5e', 'polymorphSettings', settings);
      return settings;
    };

    // Create and render the Dialog
    return new Dialog({
      title: game.i18n.localize('SW5E.PolymorphPromptTitle'),
      content: {
        options: game.settings.get('sw5e', 'polymorphSettings'),
        i18n: SW5E.polymorphSettings,
        isToken: this.actor.isToken
      },
      default: 'accept',
      buttons: {
        accept: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('SW5E.PolymorphAcceptSettings'),
          callback: html => this.actor.transformInto(sourceActor, rememberOptions(html))
        },
        wildshape: {
          icon: '<i class="fas fa-paw"></i>',
          label: game.i18n.localize('SW5E.PolymorphWildShape'),
          callback: html => this.actor.transformInto(sourceActor, {
            keepMental: true,
            mergeSaves: true,
            mergeSkills: true,
            transformTokens: rememberOptions(html).transformTokens
          })
        },
        polymorph: {
          icon: '<i class="fas fa-pastafarianism"></i>',
          label: game.i18n.localize('SW5E.Polymorph'),
          callback: html => this.actor.transformInto(sourceActor, {
            transformTokens: rememberOptions(html).transformTokens
          })
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('Cancel')
        }
      }
    }, {
      classes: ['dialog', 'sw5e'],
      width: 600,
      template: 'systems/sw5e/templates/apps/polymorph-prompt.html'
    }).render(true);
  }

  /* -------------------------------------------- */
  
  /** @override */
  async _onDropItemCreate(itemData) {

    // Create a Consumable power scroll on the Inventory tab
    if ( (itemData.type === "power") && (this._tabs[0].active === "inventory") ) {
      const scroll = await Item5e.createScrollFromPower(itemData);
      itemData = scroll.data;
    }

    // Create the owned item as normal
    // TODO remove conditional logic in 0.7.x
    if (isNewerVersion(game.data.version, "0.6.9")) return super._onDropItemCreate(itemData);
    else return this.actor.createEmbeddedEntity("OwnedItem", itemData);
  }

  /* -------------------------------------------- */

  /**
   * Handle enabling editing for a power slot override value
   * @param {MouseEvent} event    The originating click event
   * @private
   */
  async _onPowerSlotOverride (event) {
    const span = event.currentTarget.parentElement;
    const level = span.dataset.level;
    const override = this.actor.data.data.powers[level].override || span.dataset.slots;
    const input = document.createElement("INPUT");
    input.type = "text";
    input.name = `data.powers.${level}.override`;
    input.value = override;
    input.placeholder = span.dataset.slots;
    input.dataset.dtype = "Number";

    // Replace the HTML
    const parent = span.parentElement;
    parent.removeChild(span);
    parent.appendChild(input);
  }

  /* -------------------------------------------- */

  /**
   * Change the uses amount of an Owned Item within the Actor
   * @param {Event} event   The triggering click event
   * @private
   */
  async _onUsesChange(event) {
      event.preventDefault();
      const itemId = event.currentTarget.closest(".item").dataset.itemId;
      const item = this.actor.getOwnedItem(itemId);
      const uses = Math.clamped(0, parseInt(event.target.value), item.data.data.uses.max);
      event.target.value = uses;
      return item.update({ 'data.uses.value': uses });
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
   * @private
   */
  _onItemRoll(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);

    // Roll powers through the actor
    if ( item.data.type === "power" ) {
      return this.actor.usePower(item, {configureDialog: !event.shiftKey});
    }

    // Otherwise roll the Item directly
    else return item.roll();
  }

  /* -------------------------------------------- */

  /**
   * Handle attempting to recharge an item usage by rolling a recharge check
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemRecharge(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);
    return item.rollRecharge();
  };

  /* -------------------------------------------- */

  /**
   * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
   * @private
   */
  _onItemSummary(event) {
    event.preventDefault();
    let li = $(event.currentTarget).parents(".item"),
        item = this.actor.getOwnedItem(li.data("item-id")),
        chatData = item.getChatData({secrets: this.actor.owner});

    // Toggle summary
    if ( li.hasClass("expanded") ) {
      let summary = li.children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
      let div = $(`<div class="item-summary">${chatData.description.value}</div>`);
      let props = $(`<div class="item-properties"></div>`);
      chatData.properties.forEach(p => props.append(`<span class="tag">${p}</span>`));
      div.append(props);
      li.append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass("expanded");
  }

  /* -------------------------------------------- */

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const itemData = {
      name: game.i18n.format("SW5E.ItemNew", {type: type.capitalize()}),
      type: type,
      data: duplicate(header.dataset)
    };
    delete itemData.data["type"];
    return this.actor.createOwnedItem(itemData);
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    const item = this.actor.getOwnedItem(li.dataset.itemId);
    item.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    this.actor.deleteOwnedItem(li.dataset.itemId);
  }

  /* -------------------------------------------- */

  /**
   * Manage Active Effect instances through the Actor Sheet via effect control buttons.
   * @param {MouseEvent} event     The left-click event on the effect control
   * @private
   */
  _onManageActiveEffect(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const li = a.closest(".effect");
    const effect = this.actor.effects.get(li.dataset.effectId);
    switch ( a.dataset.action ) {
      case "edit":
        return effect.sheet.render(true);
      case "delete":
        return effect.delete();
      case "toggle":
        return effect.update({disabled: !effect.data.disabled});
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling an Ability check, either a test or a saving throw
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollAbilityTest(event) {
    event.preventDefault();
    let ability = event.currentTarget.parentElement.dataset.ability;
    this.actor.rollAbility(ability, {event: event});
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling a Skill check
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollSkillCheck(event) {
    event.preventDefault();
    const skill = event.currentTarget.parentElement.dataset.skill;
    this.actor.rollSkill(skill, {event: event});
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling Ability score proficiency level
   * @param {Event} event     The originating click event
   * @private
   */
  _onToggleAbilityProficiency(event) {
    event.preventDefault();
    const field = event.currentTarget.previousElementSibling;
    this.actor.update({[field.name]: 1 - parseInt(field.value)});
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling of filters to display a different set of owned items
   * @param {Event} event     The click event which triggered the toggle
   * @private
   */
  _onToggleFilter(event) {
    event.preventDefault();
    const li = event.currentTarget;
    const set = this._filters[li.parentElement.dataset.filter];
    const filter = li.dataset.filter;
    if ( set.has(filter) ) set.delete(filter);
    else set.add(filter);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle spawning the TraitSelector application which allows a checkbox of multiple trait options
   * @param {Event} event   The click event which originated the selection
   * @private
   */
  _onTraitSelector(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const label = a.parentElement.querySelector("label");
    const choices = CONFIG.SW5E[a.dataset.options];
    const options = { name: a.dataset.target, title: label.innerText, choices };
    new TraitSelector(this.actor, options).render(true)
  }

  /* -------------------------------------------- */

  /** @override */
  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();

    // Add button to revert polymorph
    if ( !this.actor.isPolymorphed || this.actor.isToken ) return buttons;
    buttons.unshift({
      label: 'SW5E.PolymorphRestoreTransformation',
      class: "restore-transformation",
      icon: "fas fa-backward",
      onclick: ev => this.actor.revertOriginalForm()
    });
    return buttons;
  }
  
  /* -------------------------------------------- */
  /*  DEPRECATED                                  */
  /* -------------------------------------------- */

  /**
   * TODO: Remove once 0.7.x is release
   * @deprecated since 0.7.0
   */
  async _onDrop (event) {
    event.preventDefault();

    // Get dropped data
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      return false;
    }
    if ( !data ) return false;

    // Handle the drop with a Hooked function
    const allowed = Hooks.call("dropActorSheetData", this.actor, this, data);
    if ( allowed === false ) return;

    // Case 1 - Dropped Item
    if ( data.type === "Item" ) {
      return this._onDropItem(event, data);
    }

    // Case 2 - Dropped Actor
    if ( data.type === "Actor" ) {
      return this._onDropActor(event, data);
    }
  }

  /* -------------------------------------------- */

  /**
   * TODO: Remove once 0.7.x is release
   * @deprecated since 0.7.0
   */
  async _onDropItem(event, data) {
    if ( !this.actor.owner ) return false;
    let itemData = await this._getItemDropData(event, data);

    // Handle item sorting within the same Actor
    const actor = this.actor;
    let sameActor = (data.actorId === actor._id) || (actor.isToken && (data.tokenId === actor.token.id));
    if (sameActor) return this._onSortItem(event, itemData);

    // Create a new item
    this._onDropItemCreate(itemData);
  }

  /* -------------------------------------------- */

  /**
   * TODO: Remove once 0.7.x is release
   * @deprecated since 0.7.0
   */
  async _getItemDropData(event, data) {
    let itemData = null;

    // Case 1 - Import from a Compendium pack
    if (data.pack) {
      const pack = game.packs.get(data.pack);
      if (pack.metadata.entity !== "Item") return;
      itemData = await pack.getEntry(data.id);
    }

    // Case 2 - Data explicitly provided
    else if (data.data) {
      itemData = data.data;
    }

    // Case 3 - Import from World entity
    else {
      let item = game.items.get(data.id);
      if (!item) return;
      itemData = item.data;
    }

    // Return a copy of the extracted data
    return duplicate(itemData);
  }
}