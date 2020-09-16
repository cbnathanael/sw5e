import { getItemActiveEffects, doEffects } from "../dynamiceffects.js";
export class ActiveItemSelector extends FormApplication {
    constructor() {
        super(...arguments);
        this.activate = true;
        this.process = (event) => {
            this.activate = event.target.id === "active";
        };
    }
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "active-item-selector";
        options.classes = ["sw5e"];
        options.title = game.i18n.localize("dynamiceffects.ActiveItemSelect");
        options.template = "./modules/dynamiceffects/templates/activeItem-selector.html";
        options.height = 275;
        options.width = 275;
        return options;
    }
    static initActions() { }
    static setupActions() { }
    getData() {
        // created with an actor
        let data = super.getData();
        data.itemList = {};
        this.object.items
            .filter(item => getItemActiveEffects(item.data).length > 0)
            .sort((i1, i2) => i1.name > i2.name ? 1 : -1)
            .forEach(item => {
            data.itemList[item.id] = ({ type: item.data.type, name: item.name });
        });
        data.itemId = "";
        data.submit = "";
        return data;
    }
    activateListeners(html) {
        super.activateListeners(html);
        html.find(".activatebutton").click(this.process);
    }
    async _updateObject(event, formData) {
        let item = this.object.items.find(i => i.id === formData.itemId);
        if (item) {
            doEffects({ item, actor: this.object, activate: this.activate });
        }
    }
}
