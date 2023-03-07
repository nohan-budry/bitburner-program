import { NS } from '@ns';
import { Display } from './display';

export type ParameterValue = string | number | boolean | null;

export enum ParameterType {
	string = 0,
	number,
	boolean,
}

export class Parameter {
	name: string;
	type: ParameterType;
	required: boolean;
	defaultValue?: ParameterValue;

	constructor(name: string, type: ParameterType, required: boolean, defaultValue?: ParameterValue) {
		this.name = name;
		this.type = type;
		this.required = required;
		this.defaultValue = defaultValue;
	}

	public parse(ns: NS, value: string | null | undefined): ParameterValue {
		if (value === undefined) {
			if (this.required) throw `Parameter ${this.name} is required!`;
			return this.defaultValue !== undefined ? this.defaultValue : null;
		}

		switch (this.type) {
			case ParameterType.string:
				return value;

			case ParameterType.number: {
				if (value == null) return null;

				const numberValue = Number(value);
				if (Number.isNaN(numberValue) || !Number.isFinite(numberValue)) {
					throw `Parameter ${this.name} expected a number but received ${value}`;
				}
				return numberValue;
			}
			case ParameterType.boolean:
				if (value == null) return true;
				if (['t', 'true', '1', 'y', 'yes'].includes(value.toLowerCase())) return true;
				if (['f', 'false', '0', 'n', 'no'].includes(value.toLowerCase())) return false;
				throw `Parameter ${this.name} expected a boolean value but received ${value}`;
		}
	}
}

type CommandCallback = (parameters: Map<string, ParameterValue>) => Promise<void>;

export class Command {
	name: string;
	parameters: Parameter[];
	callback: CommandCallback;
	usage: string;
	description: string;

	constructor(name: string, callback: CommandCallback, parameters: Parameter[], usage: string, description: string) {
		this.name = name;
		this.callback = callback;
		this.parameters = parameters;
		this.usage = usage;
		this.description = description;
	}

	public async execute(program: Program, rawParameters: string[]): Promise<void> {
		const parameters = this.parseParameters(program.ns, rawParameters);
		await this.callback.call(program, parameters);
	}

	public parseParameters(ns: NS, rawParameters: string[]): Map<string, ParameterValue> {
		const rawParametersMap: Map<string, string | null> = new Map();

		let index = 0;
		for (const rawParameter of rawParameters) {
			if (rawParameter.startsWith('--')) {
				// eslint-disable-next-line prefer-const
				let [key, value, ...rest]: (string | undefined)[] = rawParameter.slice(2).split('=');
				if (rest.length > 0) {
					value += `=${rest.join('=')}`;
				}

				if (key != undefined) {
					rawParametersMap.set(key, value != undefined ? value : null);
				}
			} else {
				rawParametersMap.set(index.toString(), rawParameter);
				index += 1;
			}
		}

		const parsedParameters: Map<string, ParameterValue> = new Map();
		for (const parameter of this.parameters) {
			const parameterValue: ParameterValue = parameter.parse(ns, rawParametersMap.get(parameter.name));
			parsedParameters.set(parameter.name, parameterValue);
		}

		return parsedParameters;
	}
}

export type AutocompleteData = { servers: string[]; txts: string[]; scripts: string[] };

export abstract class Program {
	public initialised = false;
	public ns!: NS;
	public display!: Display;
	public commands: Map<string, Command> = new Map();

	protected abstract get programName(): string;

	protected abstract get programUsage(): string;

	protected abstract get programDescription(): string;

	constructor() {
		this.addCommand(new Command('help', this.help, [], 'help', 'Shows a list of available commands.'));
	}

	public initialise(ns: NS, display: Display): void {
		this.initialised = true;

		this.ns = ns;
		this.display = display;
	}

	public addCommand(command: Command) {
		this.commands.set(command.name, command);
	}

	public async execute(args: (string | number | boolean)[]): Promise<void> {
		if (!this.initialised) {
			throw `Program not yet initialised!`;
		}

		const [commandName, ...rawParameters] = args.map((args) => args.toString());

		const command: Command | undefined = this.commands.get(commandName);
		if (!command) {
			throw `Unkown command: ${commandName}!`;
		}

		try {
			await command.execute(this, rawParameters);
		} catch (error: unknown) {
			const message = `FATAL: ${error}`;
			this.display.logError(message);
			this.display.printError(message);
			throw error;
		}
	}

	public async help() {
		if (!this.initialised) {
			throw `Program not yet initialised!`;
		}

		const helpInfo: string[] = [];

		helpInfo.push(`${this.programName}:`);
		helpInfo.push(`Usage: ${this.programUsage}`);
		helpInfo.push(`Description: ${this.programDescription}`);
		helpInfo.push('');
		helpInfo.push('Commands:');

		let usageColumnLength = 0;
		for (const command of this.commands.values()) {
			if (command.usage.length > usageColumnLength) {
				usageColumnLength = command.usage.length;
			}
		}

		for (const command of this.commands.values()) {
			const spacer = ' '.repeat(usageColumnLength - command.usage.length);
			helpInfo.push(`    ${command.usage}${spacer}\t${command.description}`);
		}

		this.display.print(helpInfo.join('\n    '));
	}

	public autocomplete(data: AutocompleteData, args: string[]): string[] {
		if (args.length <= 1) {
			return Array.from(this.commands.keys());
		} else {
			const lastArg = args[args.length - 1];
			if (lastArg.startsWith('--')) {
				if (lastArg.includes('=')) {
					return data.servers.map((server) => `--${lastArg.slice(2).split('=')[0]}=${server}`);
				} else {
					const command = this.commands.get(args[0]);
					if (command !== undefined) {
						return command.parameters
							.filter((parameter) => Number.isNaN(Number(parameter.name)))
							.map((parameter) => `--${parameter.name}`);
					}
				}
			} else {
				return [...data.servers, ...data.scripts];
			}
		}

		return [];
	}
}
