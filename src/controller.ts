import { NS } from '@ns';
import { AutocompleteData, Command, Parameter, ParameterType, ParameterValue, Program } from '@/lib/program';
import { Display } from '@/lib/display';

export async function main(ns: NS) {
	if (ns.tryWritePort(BurnerControllerProgram.MESSAGE_PORT, ns.args.join(' '))) {
		ns.tprint('Data written to port!');
	} else {
		ns.tprint('Failed to write data to port!');
	}
}

export function autocomplete(data: AutocompleteData, args: string[]) {
	const program = new BurnerControllerProgram();
	return program.autocomplete(data, args);
}

export interface BurnerControllerDelegate {
	showNextPodOperation(): Promise<void>;

	killBurner(): Promise<void>;

	toggleDebugMode(parameters: Map<string, ParameterValue>): Promise<void>;

	toggleGatherMoney(parameters: Map<string, ParameterValue>): Promise<void>;
}

export class BurnerControllerProgram extends Program implements BurnerControllerDelegate {
	static MESSAGE_PORT = 20;
	private delegate?: BurnerControllerDelegate;

	constructor(delegate?: BurnerControllerDelegate) {
		super();
		this.delegate = delegate;

		this.addCommand(
			new Command(
				'next-pod-operation',
				this.showNextPodOperation,
				[],
				'next-pod-operation',
				'Shows the next purchase or upgrade on a pod if any.',
			),
		);
		this.addCommand(new Command('kill', this.killBurner, [], 'kill', 'Kills the burner.'));
		this.addCommand(
			new Command(
				'debug',
				this.toggleDebugMode,
				[new Parameter('off', ParameterType.boolean, false, false)],
				'debug [--off]',
				'Turns debug mode on or off.',
			),
		);
		this.addCommand(
			new Command(
				'gather-money',
				this.toggleGatherMoney,
				[new Parameter('off', ParameterType.boolean, false, false)],
				'gather-money [--off]',
				'Turns gather money mode on or off.',
			),
		);
	}

	protected get programDescription(): string {
		return '';
	}

	protected get programName(): string {
		return 'Burner Controller';
	}

	protected get programUsage(): string {
		return 'controller <command> [...args]';
	}

	public initialise(ns: NS, display: Display) {
		super.initialise(ns, display);
	}

	async showNextPodOperation(): Promise<void> {
		await this.delegate?.showNextPodOperation();
	}

	async killBurner(): Promise<void> {
		await this.delegate?.killBurner();
	}

	async toggleDebugMode(parameters: Map<string, ParameterValue>): Promise<void> {
		await this.delegate?.toggleDebugMode(parameters);
	}

	async toggleGatherMoney(parameters: Map<string, ParameterValue>): Promise<void> {
		await this.delegate?.toggleGatherMoney(parameters);
	}
}
