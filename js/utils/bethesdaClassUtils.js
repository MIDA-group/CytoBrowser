bethesdaClassUtils = {
    amountClasses: 7,
    classes: [
        {
            name: "NILM",
            description: "Negative for intraepithelial lesion or malignancy",
            color: "#3F3"
        },
        {
            name: "ASC-US",
            description: "Atypical squamous cells of undetermined significance",
            color: "#CA3"
        },
        {
            name: "ASC-H",
            description: "Atypical squamous cell - cannot exclude HSIL",
            color: "#F33"
        },
        {
            name: "LSIL",
            description: "Low squamous intraepithelial lesion",
            color: "#3CC"
        },
        {
            name: "HSIL",
            description: "High squamous intraepithelial lesion",
            color: "#F4F"
        },
        {
            name: "SCC",
            description: "Squamous cell carcinoma",
            color: "#CF6"
        },
        {
            name: "AdC",
            description: "Adenocarcinoma",
            color: "#FC6"
        }
    ],
    classColor: function(id) {
        return bethesdaClassUtils.classes[id].color;
    },
    getClassFromID: function(id) {
        return bethesdaClassUtils.classes[id];
    },
    getIDFromName: function(name) {
        return bethesdaClassUtils.classes.findIndex((entry) => name == entry.name);
    },
    forEachClass: function(f) {
        bethesdaClassUtils.classes.forEach(f);
    }
}
