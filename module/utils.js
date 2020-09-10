//@ts-ignore
var tokenizer = new DETokenizeThis({
    shouldTokenize: ['(', ')', ',', '*', '/', '%', '+', '=', '!=', '!', '<', '>', '<=', '>=', '^', '-']
});
export function mergeObjectPlusLookup(original, other = {}, { insertKeys = true, insertValues = true, overwrite = true, inplace = true, enforceTypes = false, context = {}, debug = false, sampleValue = "" } = {}, _d = 0) {
    other = other || {};
    if (!(original instanceof Object) || !(other instanceof Object)) {
        throw new Error("One of original or other are not Objects!");
    }
    let depth = _d + 1;
    // Maybe copy the original data at depth 0
    if (!inplace && (_d === 0))
        original = duplicate(original);
    // Enforce object expansion at depth 0
    if ((_d === 0) && Object.keys(original).some(k => /\./.test(k)))
        original = expandObject(original);
    if ((_d === 0) && Object.keys(other).some(k => /\./.test(k)))
        other = expandObject(other);
    if (debug)
        console.log("mergeObjectPlusLookup", _d, duplicate(original), duplicate(other));
    // Iterate over the other object
    for (let [k, v] of Object.entries(other)) {
        if (debug)
            console.log("merge object loop doing ", duplicate(k), duplicate(v));
        let tv = getType(v);
        // Prepare to delete
        let toDelete = false;
        if (k.startsWith("-=")) {
            k = k.slice(2);
            toDelete = (v === null);
        }
        let toAdd = false;
        if (k.startsWith("+")) {
            if (debug)
                console.log("Found adder", k, k.slice(1));
            k = k.slice(1);
            toAdd = true;
            if (debug)
                console.log("new key is ", k);
        }
        // Get the existing object
        let x = original[k];
        let has = original.hasOwnProperty(k);
        let tx = getType(x);
        // Ensure that inner objects exist
        if (!has && (tv === "Object")) {
            x = original[k] = {};
            has = true;
            tx = "Object";
        }
        // Case 1 - Key exists
        if (has) {
            if (debug)
                console.log("Key exists ", duplicate(tv), duplicate(tx), Array.isArray(x), x, typeof x);
            // 1.1 - Recursively merge an inner object
            if ((tv === "Object") && (tx === "Object") && !Array.isArray(x)) {
                if (debug)
                    console.log("doing recursive merge", k, v);
                mergeObjectPlusLookup(x, v, {
                    insertKeys: insertValues,
                    insertValues: insertValues,
                    overwrite: overwrite,
                    inplace: true,
                    enforceTypes: enforceTypes,
                    context: context,
                    sampleValue: sampleValue,
                    debug: debug
                }, depth);
            }
            // 1.2 - Remove an existing key
            else if (toDelete) {
                delete original[k];
            }
            // 1.3 - Overwrite existing value
            else if (overwrite && !toAdd) {
                if (tx && (tv !== tx) && enforceTypes) {
                    throw new Error(`Mismatched data types encountered during object merge.`);
                }
                var val = v;
                if (typeof v === "string")
                    val = getValue(v, sampleValue, context);
                if (typeof val === "string") {
                    try {
                        val = JSON.parse(val);
                    }
                    catch (err) { }
                }
                original[k] = val;
            }
            // 1.4 - Insert new value
            else if ((x === undefined) && insertValues) {
                if (debug)
                    console.log("X undefined");
                original[k] = getValue(v, sampleValue, context);
            }
            else if (x !== undefined) {
                if (Array.isArray(x)) {
                    if (!toAdd || !original[k])
                        original[k] = x;
                    //@ts-ignore
                    else if (!original[k].includes(v))
                        original[k] = original[k].concat(v);
                }
                else if (typeof x === "number" || (typeof x === "string" && typeof sampleValue === "number")) { // number
                    // we do a roll here as the target is a number and we need to resolve the values including rolling values
                    try {
                        v = new Roll(`0+${v}`, context).roll().total;
                    }
                    catch (err) {
                        console.warn("Dyamiceffects | could not evaluate: ", v, context, typeof x, typeof sampleValue);
                        v = 0;
                    }
                    original[k] = ((toAdd && original[k]) ? original[k] : 0) + Number(v);
                    if (debug)
                        console.log("Doing number", duplicate(x), duplicate(v), original[k]);
                }
                else if (typeof x === "string") {
                    // Check for embedded @s in the string if so we string concatenate the lookup value or just add a string value like 1d4
                    if (typeof v === "string")
                        v = doLookups(v, context);
                    let joiner = k === "custom" ? ";" : "+";
                    original[k] = `${((toAdd && original[k]) ? (original[k] + joiner) : "")}${v}`;
                    if (debug)
                        console.log("Doing string", duplicate(x), duplicate(v), original[k]);
                }
                else if (x === null) {
                    original[k] = getValue(v, sampleValue, context);
                }
            }
        }
        // Case 2 - Key does not exist
        else if (!toDelete) {
            let canInsert = (depth === 1 && insertKeys) || (depth > 1 && insertValues);
            if (canInsert)
                original[k] = getValue(v, sampleValue, context);
        }
    }
    // Return the object for use
    return original;
}
export function doLookups(v, context) {
    if (typeof v !== "string")
        return v;
    // special check for (expr)dy - eval expr to X but leave result as XdY
    let special = v.match(/\((.*)\)d([0-9]*)/);
    var result;
    if (special && special.length === 3) {
        try {
            result = new Roll(special[1], context).roll().total + "d" + special[2];
        }
        catch (err) {
            console.warn(`Dynamiceffects eval error for: ${special[1]}`);
            result = "";
        }
        return result;
    }
    if (!v.includes("@"))
        return v;
    result = [];
    tokenizer.tokenize(v, t => {
        if (typeof t === "string" && t.startsWith("@"))
            result.push(getProperty(context, t.slice(1)) || t);
        else
            result.push(t);
    });
    return result.join(" ");
}
export function getValue(v, sampleValue, context) {
    let sampleType = typeof sampleValue;
    if (sampleType === "string") {
        if (typeof v === "string")
            return doLookups(v, context);
        return `${v}`;
    }
    else if (sampleType === "number") {
        if (typeof v === "string") {
            try {
                v = (new Roll(v, context)).roll().total;
            }
            catch (err) {
                console.warn("Dynamiceffects | Could not evaluate: ", v, sampleValue, typeof sampleValue, typeof v);
                v = 0;
            }
            return v;
        }
    }
    else if (Array.isArray(sampleValue)) {
        if (typeof v === "string")
            return [doLookups(v, context)];
        return [v];
    }
    else {
        if (typeof v === "string")
            return doLookups(v, context);
        return v;
    }
}
export async function convertToTrinket(item) {
    if (item.type !== "loot") {
        ui.notifications.error(`${item.name} is not of type loot`);
        return;
    }
    let newItem = await CONFIG.Item.entityClass.create({ "name": `${item.name} (Converted)`, type: "equipment" });
    await newItem.update({ "data.description": item.data.data.description, "data.weight": item.data.data.weight, "data.quantity": item.data.data.quanity, "data.price": item.data.data.price,
        "data.armor.type": "trinket", "img": item.data.img, "flags.itemcollection": item.data.flags.itemcollection, "flags.dynamicitems": item.data.flags.dynamicitems });
    console.log(`${item.name} converted`);
}
