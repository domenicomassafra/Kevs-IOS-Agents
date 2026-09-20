export function physicalIosLaneEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.PHONE_FARM_ENABLE_PHYSICAL_IOS !== 'false';
}
