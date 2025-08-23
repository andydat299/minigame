// Rod durability configuration
export const ROD_DURABILITY_CONFIG = {
    // Durability loss per fishing attempt
    DURABILITY_LOSS_PER_FISH: {
        1: 2,  // Rod level 1: loses 2 durability per fish
        2: 1.5,
        3: 1.2,
        4: 1,
        5: 0.8,
        6: 0.6,
        7: 0.5,
        8: 0.4,
        9: 0.3,
        10: 0.2
    },
    
    // Max durability for each rod level
    MAX_DURABILITY: {
        1: 100,
        2: 150,
        3: 200,
        4: 250,
        5: 300,
        6: 350,
        7: 400,
        8: 450,
        9: 500,
        10: 600
    },
    
    // Repair costs per durability point
    REPAIR_COST_PER_POINT: {
        1: 5,
        2: 8,
        3: 12,
        4: 15,
        5: 20,
        6: 25,
        7: 30,
        8: 35,
        9: 40,
        10: 50
    },
    
    // Minimum durability to fish (rod breaks if below this)
    MIN_DURABILITY_TO_FISH: 1,
    
    // Durability warning threshold
    WARNING_THRESHOLD: 20,
    
    // Critical durability threshold (fishing efficiency reduced)
    CRITICAL_THRESHOLD: 10
};

// Function to get rod durability loss for a specific rod level
export function getDurabilityLoss(rodLevel) {
    return ROD_DURABILITY_CONFIG.DURABILITY_LOSS_PER_FISH[rodLevel] || 2;
}

// Function to get max durability for rod level
export function getMaxDurability(rodLevel) {
    return ROD_DURABILITY_CONFIG.MAX_DURABILITY[rodLevel] || 100;
}

// Function to get repair cost for rod level
export function getRepairCost(rodLevel, durabilityToRepair) {
    const costPerPoint = ROD_DURABILITY_CONFIG.REPAIR_COST_PER_POINT[rodLevel] || 5;
    return Math.ceil(costPerPoint * durabilityToRepair);
}

// Function to check if rod is in critical condition
export function isRodCritical(durability) {
    return durability <= ROD_DURABILITY_CONFIG.CRITICAL_THRESHOLD;
}

// Function to check if rod needs warning
export function shouldWarnDurability(durability) {
    return durability <= ROD_DURABILITY_CONFIG.WARNING_THRESHOLD;
}