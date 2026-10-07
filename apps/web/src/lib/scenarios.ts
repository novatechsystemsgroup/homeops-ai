export interface Scenario {
  id: string;
  label: string;
  hint: string;
  icon: string;
  text: string;
  /** Emergency examples are highlighted in the picker. */
  emergency?: boolean;
}

/**
 * Starter examples only. The console accepts any description of a household problem;
 * these exist so a first-time visitor always has something concrete to click.
 */
export const SCENARIOS: Scenario[] = [
  {
    id: "boiler-noise",
    label: "Boiler making noise",
    hint: "No smell, hot water still works",
    icon: "🔊",
    text: "The boiler is making a loud humming noise. We have guests arriving on Saturday and I do not want to be without hot water."
  },
  {
    id: "no-hot-water",
    label: "No hot water",
    hint: "Radiators cold, elderly parent at home",
    icon: "🚿",
    text: "There is no hot water since yesterday and the radiators are cold. My elderly mother lives with us."
  },
  {
    id: "kitchen-leak",
    label: "Leak under the sink",
    hint: "Water in the kitchen cupboard",
    icon: "💧",
    text: "Water is dripping under the kitchen sink and the cupboard floor is wet. It started this morning."
  },
  {
    id: "socket-sparks",
    label: "Socket sparked",
    hint: "Burnt smell, safety critical",
    icon: "⚡",
    emergency: true,
    text: "The socket in the hallway sparked when I plugged something in and there is a burnt smell."
  },
  {
    id: "washing-machine",
    label: "Washing machine",
    hint: "Won't drain, water standing inside",
    icon: "🧺",
    text: "The washing machine will not drain and there is standing water inside the drum. The filter light is on."
  },
  {
    id: "fridge-warm",
    label: "Fridge not cold",
    hint: "Food shop arriving tomorrow",
    icon: "🧊",
    text: "The fridge is not getting cold and we have a full food shop being delivered tomorrow."
  },
  {
    id: "front-door-lock",
    label: "Front door lock",
    hint: "Key turns but the door won't lock",
    icon: "🔑",
    text: "The front door lock turns but does not lock properly. We need to leave the house locked tonight."
  },
  {
    id: "gas-smell",
    label: "Smell of gas",
    hint: "Emergency path, deterministic rules",
    icon: "🔥",
    emergency: true,
    text: "There is a smell of gas next to the boiler cupboard and we have guests arriving tonight."
  }
];

export function scenarioById(id: string | null | undefined): Scenario | undefined {
  if (!id) return undefined;
  return SCENARIOS.find((scenario) => scenario.id === id);
}
