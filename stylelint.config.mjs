const stylelintConfig = {
  extends: ["stylelint-config-standard"],
  rules: {
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "apply",
          "config",
          "custom-variant",
          "layer",
          "plugin",
          "source",
          "theme",
        ],
      },
    ],
    "hue-degree-notation": null,
    "import-notation": null,
    "lightness-notation": null,
    "selector-class-pattern": null,
  },
};

export default stylelintConfig;
