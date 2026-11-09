// Converts the Altium export (altiumbom) into the pcbdata structure used by
// the InteractiveHtmlBom frontend.
//
// All components of the board are exported. Each component carries its state
// in every assembly variant:
//   "variants": [{"fitted": true, "fields": {"Value": "10k", ...}}, ...]
// indexed like altiumbom.variants (index 0 = "[No Variations]"). The BOM is
// built for one variant at a time and rebuilt when the variant is switched in
// the browser (see altium-variants.js).

var ALTIUM_DEFAULT_GROUP_FIELDS = ["Value", "Footprint"];

// Effective value of a field for a component in the given variant.
function altiumGetField(comp, field, variantIndex) {
  var state = altiumVariantState(comp, variantIndex);
  if (state && state.fields && field in state.fields) {
    return state.fields[field];
  }
  if (field == "Value") return comp.val;
  if (field == "Footprint") return comp.footprint;
  if (comp.extra_fields && field in comp.extra_fields) {
    return comp.extra_fields[field];
  }
  return "";
}

function altiumGetFields(comp, fields, variantIndex) {
  return fields.map((field) => altiumGetField(comp, field, variantIndex));
}

function altiumVariantState(comp, variantIndex) {
  if (!comp.variants || variantIndex < 0 || variantIndex >= comp.variants.length) {
    return null;
  }
  return comp.variants[variantIndex];
}

// Component is placed on the board in the given variant.
function altiumIsFitted(comp, variantIndex) {
  var state = altiumVariantState(comp, variantIndex);
  return state ? state.fitted !== false : true;
}

// Component appears in the BOM of the given variant.
function altiumInBom(comp, variantIndex) {
  var noBom = comp.no_bom || (comp.extra_fields && comp.extra_fields.NoBOM === true);
  return !noBom && altiumIsFitted(comp, variantIndex);
}

// Builds pcbdata.bom for one variant. Components that are not fitted (or are
// excluded from the BOM) are listed in bom.skipped, so the frontend draws them
// with the DNP outline and leaves them out of the BOM table.
function altiumBuildBom(data, config, altiumconfig, variantIndex) {
  var groupFields = (altiumconfig.group_fields && altiumconfig.group_fields.length) ?
    altiumconfig.group_fields : ALTIUM_DEFAULT_GROUP_FIELDS;
  var showFields = config.fields;

  var bom = {
    both: [],
    F: [],
    B: [],
    skipped: [],
    fields: {},
  };
  var groups = {
    both: new Map(),
    F: new Map(),
    B: new Map(),
  };

  function addToGroup(layer, key, entry) {
    if (!groups[layer].has(key)) {
      groups[layer].set(key, []);
    }
    groups[layer].get(key).push(entry);
  }

  data.components.forEach((comp, index) => {
    bom.fields[index] = altiumGetFields(comp, showFields, variantIndex);
    if (!altiumInBom(comp, variantIndex)) {
      bom.skipped.push(index);
      return;
    }
    var key = JSON.stringify(altiumGetFields(comp, groupFields, variantIndex));
    var entry = [comp.ref, index];
    addToGroup("both", key, entry);
    if (comp.layer == "F" || comp.layer == "B") {
      addToGroup(comp.layer, key, entry);
    }
  });

  for (var layer of ["both", "F", "B"]) {
    bom[layer] = Array.from(groups[layer].values());
  }
  return bom;
}

function altiumVariantNames(data) {
  return (data.variants && data.variants.length) ? data.variants : ["[No Variations]"];
}

function altiumHasVariants(data) {
  return altiumVariantNames(data).length > 1;
}

function fromaltium(data, config, altiumconfig) {
  var variantIndex = data.default_variant || 0;
  var variantNames = altiumVariantNames(data);
  if (variantIndex >= variantNames.length) variantIndex = 0;

  var result = {};
  result.bom = altiumBuildBom(data, config, altiumconfig, variantIndex);

  result.drawings = data.pcbdata.drawings;
  result.edges = data.pcbdata.edges;
  result.edges_bbox = data.pcbdata.edges_bbox;
  result.font_data = data.pcbdata.font_data;
  result.footprints = data.pcbdata.footprints;
  result.metadata = data.pcbdata.metadata;
  result.nets = data.pcbdata.nets;
  result.tracks = data.pcbdata.tracks;
  result.zones = data.pcbdata.zones;

  result.metadata.variant = altiumHasVariants(data) ? variantNames[variantIndex] : "";
  result.ibom_version = "v2.12.0";

  return result;
}

var altiumCurrentVariant = altiumbom.default_variant || 0;
var pcbdata = fromaltium(altiumbom, config, altiumconfig);
