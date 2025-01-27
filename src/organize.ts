export const DEFAULT_GROUP = "$DEFAULT";

export type GroupQuery = string | RegExp;
export type GroupKey<TPresets extends Presets> =
  | keyof TPresets
  | string
  | typeof DEFAULT_GROUP;

export type Presets = Record<string, GroupQuery | GroupQuery[]>;

export type OrganizedGroup<TValue> = { values: TValue[]; query: GroupQuery };
export type OrganizedResult<TValue> = {
  groups: OrganizedGroup<TValue>[];
  flat: TValue[];
};

export interface BaseOrganizeOptions<TPresets extends Presets> {
  presets?: TPresets;
  groups: GroupKey<TPresets>[];
  sort?: OrganizeOptionsSort;
  ignoreCase?: boolean;
}

export type OrganizeOptionsSort = "ASC" | "DESC" | "UNOCSS" | boolean;
export interface MapOrganizeOptions<TPresets extends Presets, TValue>
  extends BaseOrganizeOptions<TPresets> {
  map: (value: TValue) => string;
}

export type OrganizeOptions<TPresets extends Presets, TValue> =
  | BaseOrganizeOptions<TPresets>
  | MapOrganizeOptions<TPresets, TValue>;

export function miniorganize<TPresets extends Presets>(
  values: string[],
  options: BaseOrganizeOptions<TPresets>
): OrganizedResult<string>;
export function miniorganize<TPresets extends Presets, TValue>(
  values: TValue[],
  options: MapOrganizeOptions<TPresets, TValue>
): OrganizedResult<TValue>;
export function miniorganize<TValue>(
  values: TValue[],
  options: OrganizeOptions<Presets, TValue>
): OrganizedResult<TValue> {
  const getGroups = (
    query: GroupQuery
  ): {
    regexp?: RegExp;
    unknown: boolean;
    values: TValue[];
    query: GroupQuery;
  }[] => {
    if (query === DEFAULT_GROUP) {
      return [getDefaultGroup()];
    }

    const preset = typeof query === "string" && options.presets?.[query];
    if (!preset) {
      return [
        {
          regexp: groupQueryToRegExp(query, !!options.ignoreCase),
          unknown: false,
          values: [],
          query,
        },
      ];
    }

    return Array.isArray(preset)
      ? preset.flatMap(getGroups)
      : getGroups(preset);
  };

  const groups = options.groups.flatMap(getGroups);

  let defaultGroup = groups.find((group) => group.unknown);
  if (!defaultGroup) {
    defaultGroup = getDefaultGroup();
    groups.push(defaultGroup);
  }

  const getString = (value: TValue): string => {
    if ("map" in options) {
      return options.map(value);
    } else if (typeof value === "string") {
      return value;
    } else {
      throw Error("Neither a map function nor string values were passed!");
    }
  };

  values.forEach((value) => {
    const mapped = getString(value);

    for (let group of groups) {
      if (group.regexp && mapped.match(group.regexp)) {
        group.values.push(value);
        return;
      }
    }

    defaultGroup!.values.push(value);
  });

  if (options.sort) {
    groups.forEach((group) => {
      group.values.sort((a, b) => getString(a).localeCompare(getString(b)));

      if (options.sort === "DESC") {
        group.values.reverse();
      }

      if (options.sort === "UNOCSS") {
        const onlyBg = group.values
          .filter((e) => getString(e).startsWith("bg"))
          .sort((a, b) => getString(a).localeCompare(getString(b)));

        const onlyWH = group.values
          .filter(
            (e) =>
              getString(e).startsWith("w-") || getString(e).startsWith("h-")
          )
          .sort((a, b) => getString(a).localeCompare(getString(b)));

        const onlyMP = group.values
          .filter(
            (e) =>
              getString(e).startsWith("m-") || getString(e).startsWith("p-")
          )
          .sort((a, b) => getString(a).localeCompare(getString(b)));

        const onlyText = group.values
          .filter((e) => getString(e).startsWith("text"))
          .sort((a, b) => getString(a).localeCompare(getString(b)));

        const onlyDisplayProps = group.values
          .filter(
            (e) =>
              getString(e).startsWith("flex") ||
              getString(e).startsWith("grid") ||
              getString(e).startsWith("fc") ||
              getString(e).startsWith("justify") ||
              getString(e).startsWith("items") ||
              getString(e).startsWith("relative") ||
              getString(e).startsWith("absolute") ||
              getString(e).startsWith("fixed") ||
              getString(e).startsWith("sticky") ||
              getString(e).startsWith("top") ||
              getString(e).startsWith("left") ||
              getString(e).startsWith("right") ||
              getString(e).startsWith("bottom")
          )
          .sort((a, b) => getString(a).localeCompare(getString(b)));

        const priority = group.values.filter(
          (e) => getString(e).startsWith(":") || getString(e).startsWith("@")
        );

        const knownAttrs = [
          ...priority,
          ...onlyDisplayProps,
          ...onlyWH,
          ...onlyMP,
          ...onlyText,
          ...onlyBg,
        ];

        const unknownAttrs = group.values.filter(
          (e) => !knownAttrs.includes(e)
        );

        group.values = [...knownAttrs, ...unknownAttrs];
      }
    });
  }

  return {
    flat: groups.flatMap((group) => group.values),
    groups: groups.map(({ query, values }) => ({ query, values })),
  };
}

function groupQueryToRegExp(query: GroupQuery, ignoreCase: boolean): RegExp {
  let flags = "";

  if (ignoreCase) {
    flags += "i";
  }

  return new RegExp(query, flags);
}

function getDefaultGroup() {
  return {
    unknown: true,
    values: [],
    query: DEFAULT_GROUP,
  };
}
