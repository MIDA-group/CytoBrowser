/**
 * Default classConfig, if not supplied from imported annotation file.
 * 
 * The classConfig object specified in this file describes the default
 * marker classes that can be used in the application. Each entry 
 * describes a class's name, description, and color. 
 * Order of classes matters for button order and sorting.
 */
const defaultClassConfig = [
    {
        name: "TIL",
        description: "TIL region",
        color: "#e86f26"
    },
    {
        name: "Non-TIL",
        description: "Region that does not contain any TIL regions",
        color: "#67b5da"
    },
    {
        name: "Other",
        description: "Does not fit other classes",
        color: "#919191"
    }
];
