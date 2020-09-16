export const preloadTemplates = async function () {
    const templatePaths = [
        // Add paths to "modules/dynamiceffects/templates"
        `./modules/dynamiceffects/templates/dynamiceffects-tab.html`,
        `./modules/dynamiceffects/templates/dynamiceffects-selector.html`,
        `./modules/dynamiceffects/templates/activeItem-selector.html`
    ];
    return loadTemplates(templatePaths);
};
