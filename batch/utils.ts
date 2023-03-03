/**
 * @param {NS} ns
 * @param {string} target
 * @param {number} moneyToHackRatio;
 * @returns {{
*  money: number,
*  hackThreads: number,
*  weakenThreadsForHack: number
*  growThreads: number,
*  weakenThreadsForGrow: number,
*  ramUsage: number,
* 	isSecurityDecreaseSufficient: boolean
* }} The configuration result
**/
export function computeBatchConfig(ns, target, moneyToHackRatio) {
   const HACK_SECURITY = 0.002;
   const GROW_SECURITY = 0.004;
   const WEAKEN_SECURITY = 0.05;

 const maxMoney = ns.getServerMaxMoney(target);
 const moneyToHack = maxMoney * moneyToHackRatio;
 const hackThreads = Math.floor(ns.hackAnalyzeThreads(target, moneyToHack));

 const growthAmount = maxMoney / (maxMoney - moneyToHack);
 const growThreads = Math.ceil(ns.growthAnalyze(target, growthAmount));

 const hackSecurityTotal = hackThreads * HACK_SECURITY;
 const weakenThreadsForHack = Math.ceil(hackSecurityTotal / WEAKEN_SECURITY);

 const growSecurityTotal = growThreads * GROW_SECURITY;
 const weakenThreadsForGrow = Math.ceil(growSecurityTotal / WEAKEN_SECURITY);

 const totalSecurityIncrease = hackSecurityTotal + growSecurityTotal;
 const totalSecurityDecrease = (weakenThreadsForHack + weakenThreadsForGrow) * WEAKEN_SECURITY;

 const ramUsage = (hackThreads + weakenThreadsForHack + growThreads + weakenThreadsForGrow) * 1.75;

 return {
   money: moneyToHack,
   hackThreads,
   weakenThreadsForHack,
   growThreads,
   weakenThreadsForGrow,
   ramUsage,
   isSecurityDecreaseSufficient: totalSecurityIncrease <= totalSecurityDecrease,
 };
}

export function prepareServer(ns, target, server) {

}
