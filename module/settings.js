export const registerSystemSettings = function() {

  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("sw5e", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

    /**
   * Register resting variants
   */
  game.settings.register("sw5e", "restVariant", {
    name: "SETTINGS.5eRestN",
    hint: "SETTINGS.5eRestL",
    scope: "world",
    config: true,
    default: "normal",
    type: String,
    choices: {
      "normal": "SETTINGS.5eRestPHB",
      "gritty": "SETTINGS.5eRestGritty",
      "epic": "SETTINGS.5eRestEpic",
    }
  });

  /**
   * Register diagonal movement rule setting
   */
  game.settings.register("sw5e", "diagonalMovement", {
    name: "SETTINGS.5eDiagN",
    hint: "SETTINGS.5eDiagL",
    scope: "world",
    config: true,
    default: "555",
    type: String,
    choices: {
      "555": "SETTINGS.5eDiagPHB",
      "5105": "SETTINGS.5eDiagDMG",
      "EUCL": "SETTINGS.5eDiagEuclidean",
    },
    onChange: rule => canvas.grid.diagonalRule = rule
  });

  /**
   * Register Initiative formula setting
   */
  game.settings.register("sw5e", "initiativeDexTiebreaker", {
    name: "SETTINGS.5eInitTBN",
    hint: "SETTINGS.5eInitTBL",
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });

  /**
   * Require Currency Carrying Weight
   */
  game.settings.register("sw5e", "currencyWeight", {
    name: "SETTINGS.5eCurWtN",
    hint: "SETTINGS.5eCurWtL",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  /**
   * Option to disable XP bar for session-based or story-based advancement.
   */
  game.settings.register("sw5e", "disableExperienceTracking", {
    name: "SETTINGS.5eNoExpN",
    hint: "SETTINGS.5eNoExpL",
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
  });

  /**
   * Option to automatically create Power Measured Template on roll
   */
  game.settings.register("sw5e", "alwaysPlacePowerTemplate", {
    name: "SETTINGS.5eAutoPowerTemplateN",
    hint: "SETTINGS.5eAutoPowerTemplateL",
    scope: "client",
    config: true,
    default: false,
    type: Boolean
  });

  /**
   * Option to automatically collapse Item Card descriptions
   */
  game.settings.register("sw5e", "autoCollapseItemCards", {
    name: "SETTINGS.5eAutoCollapseCardN",
    hint: "SETTINGS.5eAutoCollapseCardL",
    scope: "client",
    config: true,
    default: false,
    type: Boolean,
    onChange: s => {
      ui.chat.render();
    }
  });

  /**
   * Option to allow GMs to restrict polymorphing to GMs only.
   */
  game.settings.register('sw5e', 'allowPolymorphing', {
    name: 'SETTINGS.5eAllowPolymorphingN',
    hint: 'SETTINGS.5eAllowPolymorphingL',
    scope: 'world',
    config: true,
    default: false,
    type: Boolean
  });

  /**
   * Remember last-used polymorph settings.
   */
  game.settings.register('sw5e', 'polymorphSettings', {
    scope: 'client',
    default: {
      keepPhysical: false,
      keepMental: false,
      keepSaves: false,
      keepSkills: false,
      mergeSaves: false,
      mergeSkills: false,
      keepClass: false,
      keepFeats: false,
      keepPowers: false,
      keepItems: false,
      keepBio: false,
      keepVision: true,
      transformTokens: true
    }
  });
};
import { fetchParams } from "./dynamiceffects.js";
export const registerSettings = function () {
    game.settings.register("dynamiceffects", "ConsumeCharge", {
        name: game.i18n.localize("dynamiceffects.ConsumeCharge.Name"),
        hint: game.i18n.localize("dynamiceffects.ConsumeCharge.Hint"),
        scope: "world",
        default: true,
        config: true,
        type: Boolean
    });
    game.settings.register("dynamiceffects", "requireItemTarget", {
        name: game.i18n.localize("dynamiceffects.requireItemTarget.Name"),
        hint: game.i18n.localize("dynamiceffects.requireItemTarget.Hint"),
        scope: "world",
        default: true,
        config: true,
        type: Boolean,
        onChange: fetchParams
    });
    game.settings.register("dynamiceffects", "playersCanSeeEffects", {
        scope: "world",
        default: "None",
        config: true,
        type: String,
        choices: { none: "Never", view: "View Only", edit: "Edit" },
        onChange: fetchParams,
        name: game.i18n.localize("dynamiceffects.playersCanSeeEffects.Name"),
        hint: game.i18n.localize("dynamiceffects.playersCanSeeEffects.Hint"),
    });
    game.settings.register("dynamiceffects", "playerControlsInvisibleTokens", {
        name: game.i18n.localize("dynamiceffects.playerControlsInvisibleTokens.Name"),
        hint: game.i18n.localize("dynamiceffects.playerControlsInvisibleTokens.Hint"),
        scope: "world",
        default: false,
        config: true,
        type: Boolean,
        choices: [],
        onChange: (value) => { window.location.reload(); }
    });
    game.settings.register("dynamiceffects", "tokenEffects", {
        name: game.i18n.localize("dynamiceffects.tokenEffects.Name"),
        hint: game.i18n.localize("dynamiceffects.tokenEffects.Hint"),
        scope: "world",
        default: false,
        config: false,
        type: Boolean,
        onChange: fetchParams
    });
    game.settings.register("dynamiceffects", "calculateArmor", {
        name: game.i18n.localize("dynamiceffects.calculateArmor.Name"),
        hint: game.i18n.localize("dynamiceffects.calculateArmor.Hint"),
        scope: "world",
        default: true,
        config: true,
        type: Boolean,
        onChange: fetchParams
    });
};
