// Assembly variant selection for the Altium InteractiveHtmlBom.
//
// The generated HTML contains every component together with its state in all
// assembly variants (see altium-pcbdata.js). This script adds a radio button
// group to the header to switch the active variant at any time:
//  - the BOM table, the DNP outlines on the board and the checkbox statistics
//    are rebuilt for the selected variant,
//  - the selected variant is remembered in the browser (local storage),
//  - BOM checkbox states (e.g. "Sourced", "Placed") are stored per variant,
//    because each variant is a separately assembled board.
// Without variants in the project nothing changes compared to the plain iBOM.

(function () {
  if (typeof altiumbom === "undefined" || !altiumHasVariants(altiumbom)) {
    return;
  }

  var variantNames = altiumVariantNames(altiumbom);
  if (altiumCurrentVariant < 0 || altiumCurrentVariant >= variantNames.length) {
    altiumCurrentVariant = 0;
  }

  // Checkbox states are stored per variant: "checkbox_<name>" gets the
  // variant name appended. Other settings are shared between variants.
  var origReadStorage = readStorage;
  var origWriteStorage = writeStorage;

  function variantStorageKey(key) {
    if (typeof key === "string" && key.startsWith("checkbox_")) {
      return key + "@@variant=" + variantNames[altiumCurrentVariant];
    }
    return key;
  }

  readStorage = function (key) {
    return origReadStorage(variantStorageKey(key));
  };

  writeStorage = function (key, value) {
    origWriteStorage(variantStorageKey(key), value);
  };

  // Count only components that are part of the BOM of the active variant.
  updateCheckboxStats = function (checkbox) {
    var skipped = new Set(pcbdata.bom.skipped);
    var checked = 0;
    for (var index of getStoredCheckboxRefs(checkbox)) {
      if (!skipped.has(index)) checked++;
    }
    var total = pcbdata.footprints.length - skipped.size;
    var percent = total > 0 ? checked * 100.0 / total : 0;
    var td = document.getElementById("checkbox-stats-" + checkbox);
    td.firstChild.style.width = percent + "%";
    td.lastChild.innerHTML = checked + "/" + total + " (" + Math.round(percent) + "%)";
  };

  function applyVariant(index) {
    altiumCurrentVariant = index;
    pcbdata.bom = altiumBuildBom(altiumbom, config, altiumconfig, index);
    pcbdata.metadata.variant = variantNames[index];
    // Reload checkbox states of this variant on next access
    settings.checkboxStoredRefs = {};
  }

  window.setAltiumVariant = function (index) {
    if (index < 0 || index >= variantNames.length) return;
    applyVariant(index);
    origWriteStorage("altiumVariant", variantNames[index]);
    updateVariantSelector();
    if (!initDone) return;
    clearHighlightedFootprints();
    populateMetadata();
    // Rebuilds checkbox statistics, marked footprints and the BOM table
    setBomCheckboxes(document.getElementById("bomCheckboxes").value);
    redrawIfInitDone();
  };

  function updateVariantSelector() {
    for (var input of document.querySelectorAll("input[name=altiumVariant]")) {
      input.checked = parseInt(input.value) === altiumCurrentVariant;
    }
  }

  function createVariantSelector() {
    var style = document.createElement("style");
    style.textContent = `
      #altium-variant-selector {
        flex: 1 1 100%;
      }
      #altium-variant-selector .variant-label {
        font-weight: bold;
        margin-right: 0.5em;
      }
      #altium-variant-selector label {
        display: inline-block;
        margin-right: 1em;
        white-space: nowrap;
        cursor: pointer;
      }
      @media screen {
        #variant {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);

    var td = document.createElement("td");
    td.id = "altium-variant-selector";
    td.classList.add("hideonprint");

    var caption = document.createElement("span");
    caption.classList.add("variant-label");
    caption.textContent = "Variant:";
    td.appendChild(caption);

    variantNames.forEach((name, index) => {
      var label = document.createElement("label");
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "altiumVariant";
      input.value = index;
      input.onchange = () => setAltiumVariant(index);
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + name));
      td.appendChild(label);
    });

    document.querySelector("#fileinfodiv .fileinfo tr").appendChild(td);
    updateVariantSelector();
  }

  var origOnload = window.onload;
  window.onload = function (e) {
    // Storage is initialized by the original onload handler. Pick the stored
    // variant first, so that the BOM is built only once for it.
    initStorage();
    var stored = origReadStorage("altiumVariant");
    var storedIndex = variantNames.indexOf(stored);
    if (storedIndex >= 0 && storedIndex !== altiumCurrentVariant) {
      applyVariant(storedIndex);
    }
    createVariantSelector();
    origOnload(e);
  };
})();
