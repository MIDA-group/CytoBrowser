/**
 * Namespace for handling the metadata of a slide.
 * @namespace metadataHandler
 */
const metadataHandler = (function() {
    let _metadataValues = {};
    // Can come up with a more thorough way of doing this if needed
    const _units = {
        "nm": 1e-9,
        "µm": 1e-6,
        "mm": 1e-3,
        "m": 1,
        "km": 1e3,
        "Mm": 1e6,
        "Gm": 1e9
    };

    function _metadataValuesAsReadable() {
        const res =
            _metadataValues.SizeX &&
            _metadataValues.SizeY &&
            {
                x: _metadataValues.SizeX,
                y: _metadataValues.SizeY,
                z: _metadataValues.SizeZ || "-"
        };
        const size =
            _metadataValues.PhysicalSizeX &&
            _metadataValues.PhysicalSizeY &&
            _metadataValues.PhysicalSizeXUnit &&
            _metadataValues.PhysicalSizeYUnit &&
            {
                x: Number((res.x * _metadataValues.PhysicalSizeX).toPrecision(4)) + "&thinsp;" + _metadataValues.PhysicalSizeXUnit,
                y: Number((res.y * _metadataValues.PhysicalSizeY).toPrecision(4)) + "&thinsp;" + _metadataValues.PhysicalSizeYUnit
        };
        const date = _metadataValues.AcquisitionDate;
        const microscope = _metadataValues.MicroscopeModel;
        const magnification = _metadataValues.NominalMagnification;
        const sigbits = _metadataValues.SignificantBits;
        const nChannels = _metadataValues.SizeC;
        const readableValues = {
            resolution: res ? `${res.x} &#215; ${res.y} &#215; ${res.z}` : "-",
            size: size ? `${size.x} &#215; ${size.y}` : "-",
            date: date ? date : "-",
            microscope: microscope ? microscope : "-",
            magnification: magnification ? `${magnification}x` : "-",
            sigbits: sigbits ? `${sigbits} bits` : "-",
            nChannels: nChannels ? nChannels : "-"
        };
        return readableValues;
    }

    function _updateDisplayedMetadataValues() {
        const readableValues = _metadataValuesAsReadable();
        $("#metadata_resolution").html(readableValues.resolution);
        $("#metadata_size").html(readableValues.size);
        $("#metadata_date").html(readableValues.date);
        $("#metadata_microscope").html(readableValues.microscope);
        $("#metadata_magnification").html(readableValues.magnification);
        $("#metadata_sigbits").html(readableValues.sigbits);
        $("#metadata_nchannels").html(readableValues.nChannels);
    }

    function _updateScalebar() {
        if (_metadataValues.PhysicalSizeX && _metadataValues.PhysicalSizeXUnit) {
            const size = _metadataValues.PhysicalSizeX;
            const scale = _units[_metadataValues.PhysicalSizeXUnit];
            const metersPerPixel = size * scale;
            const pixelsPerMeter = 1 / metersPerPixel;
            tmapp.updateScalebar(pixelsPerMeter);
        }
    }

    /**
     * Update the metadata values and display them in the user interface.
     * Values that are not specified will remain as they are.
     * @param {Object} newValues New values for some or all of the
     * metadata values.
     */
    function updateMetadataValues(newValues) {
        Object.assign(_metadataValues, newValues);
        _updateDisplayedMetadataValues();
        _updateScalebar();
    }

    /**
     * Clear the currently set metadata.
     **/
    function clear() {
        _metadataValues = {};
        _updateDisplayedMetadataValues();
        _updateScalebar();
    }

    return {
        updateMetadataValues: updateMetadataValues,
        clear: clear
    };
})();
