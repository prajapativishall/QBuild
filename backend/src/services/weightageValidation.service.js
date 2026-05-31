const logger = require('../utils/logger');

class WeightageValidationService {
  // Validate and normalize weightage to ensure 100% distribution
  static normalizeWeightage(items, getWeight, setWeight, options = {}) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const {
      precision = 2,
      allowZero = false,
      totalTarget = 100,
      getManualFlag = null // Function to check if item is manually set (opted out)
    } = options;

    const round = (n) => {
      const factor = Math.pow(10, precision);
      return Math.round((n + Number.EPSILON) * factor) / factor;
    };

    const safeNumber = (v) => {
      const n = typeof v === 'string' ? parseFloat(v) : v;
      return Number.isFinite(n) ? n : 0;
    };

    // Separate manually set items from auto-managed items
    const manualItems = [];
    const autoItems = [];
    
    for (const item of items) {
      const isManual = getManualFlag ? getManualFlag(item) : false;
      if (isManual) {
        manualItems.push(item);
      } else {
        autoItems.push(item);
      }
    }

    // Calculate total weight from manually set items
    const manualTotal = manualItems.reduce((sum, item) => {
      return sum + safeNumber(getWeight(item));
    }, 0);

    // Calculate remaining target for auto-managed items
    const remainingTarget = Math.max(0, totalTarget - manualTotal);

    // Normalize auto-managed items to fill the remaining target
    let normalizedAutoItems = [];
    if (autoItems.length > 0) {
      const autoWeights = autoItems.map((item) => {
        const weight = Math.max(allowZero ? 0 : 0.01, safeNumber(getWeight(item)));
        return { item, weight };
      });

      const autoTotalWeight = autoWeights.reduce((sum, { weight }) => sum + weight, 0);

      if (autoItems.length === 1) {
        normalizedAutoItems = [setWeight(autoWeights[0].item, remainingTarget)];
      } else if (autoTotalWeight <= 0) {
        // Equal distribution when all weights are zero or invalid
        const equalWeight = round(remainingTarget / autoItems.length);
        let runningTotal = 0;
        
        normalizedAutoItems = autoWeights.map(({ item }, index) => {
          const isLast = index === autoItems.length - 1;
          const weight = isLast ? round(remainingTarget - runningTotal) : equalWeight;
          runningTotal += weight;
          return setWeight(item, weight);
        });
      } else {
        // Scale to remaining target
        const scaleFactor = remainingTarget / autoTotalWeight;
        const scaledWeights = autoWeights.map(({ item, weight }) => ({
          item,
          weight: round(weight * scaleFactor)
        }));

        // Adjust for rounding errors
        const scaledTotal = scaledWeights.reduce((sum, { weight }) => sum + weight, 0);
        const difference = round(remainingTarget - scaledTotal);

        if (difference !== 0 && scaledWeights.length > 0) {
          const largestIndex = scaledWeights.reduce((maxIndex, { weight }, index, arr) => 
            weight > arr[maxIndex].weight ? index : maxIndex, 0);
          scaledWeights[largestIndex].weight = round(scaledWeights[largestIndex].weight + difference);
        }

        normalizedAutoItems = scaledWeights.map(({ item, weight }) => setWeight(item, weight));
      }
    }

    // Combine manually set items (unchanged) with normalized auto items
    const manualResults = manualItems.map(item => {
      const weight = safeNumber(getWeight(item));
      return setWeight(item, weight);
    });

    return [...manualResults, ...normalizedAutoItems];
  }

  // Validate weightage distribution
  static validateWeightage(items, getWeight, options = {}) {
    const {
      allowZero = false,
      maxTotal = 100,
      minTotal = 100,
      tolerance = 0.01
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return { isValid: false, errors: ['No items provided'] };
    }

    const errors = [];
    const weights = items.map(getWeight).map(w => typeof w === 'string' ? parseFloat(w) : w);

    // Check individual weights
    weights.forEach((weight, index) => {
      if (!Number.isFinite(weight)) {
        errors.push(`Item ${index + 1}: Invalid weight value`);
      } else if (weight < 0) {
        errors.push(`Item ${index + 1}: Weight cannot be negative`);
      } else if (!allowZero && weight <= 0) {
        errors.push(`Item ${index + 1}: Weight must be greater than 0`);
      } else if (weight > 100) {
        errors.push(`Item ${index + 1}: Weight cannot exceed 100`);
      }
    });

    // Check total
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(total - minTotal) > tolerance && total < minTotal) {
      errors.push(`Total weight (${total}) is less than minimum required (${minTotal})`);
    }
    if (Math.abs(total - maxTotal) > tolerance && total > maxTotal) {
      errors.push(`Total weight (${total}) exceeds maximum allowed (${maxTotal})`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      total,
      itemCount: items.length
    };
  }

  // Calculate weightage statistics
  static calculateStats(items, getWeight) {
    if (!Array.isArray(items) || items.length === 0) {
      return { count: 0, total: 0, average: 0, min: 0, max: 0 };
    }

    const weights = items.map(getWeight).map(w => typeof w === 'string' ? parseFloat(w) : w);
    const validWeights = weights.filter(Number.isFinite);

    if (validWeights.length === 0) {
      return { count: items.length, total: 0, average: 0, min: 0, max: 0 };
    }

    const total = validWeights.reduce((sum, weight) => sum + weight, 0);
    const average = total / validWeights.length;
    const min = Math.min(...validWeights);
    const max = Math.max(...validWeights);

    return {
      count: items.length,
      total: Math.round(total * 100) / 100,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100
    };
  }

  // Suggest weightage redistribution
  static suggestRedistribution(items, getWeight, options = {}) {
    const {
      strategy = 'equal', // 'equal', 'proportional', 'custom'
      customWeights = null,
      preserveOrder = true
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const weights = items.map(getWeight).map(w => typeof w === 'string' ? parseFloat(w) : w);
    const total = weights.reduce((sum, weight) => sum + weight, 0);

    let suggestedWeights;

    switch (strategy) {
      case 'equal':
        suggestedWeights = new Array(items.length).fill(100 / items.length);
        break;
      
      case 'proportional':
        if (total <= 0) {
          suggestedWeights = new Array(items.length).fill(100 / items.length);
        } else {
          suggestedWeights = weights.map(w => (w / total) * 100);
        }
        break;
      
      case 'custom':
        if (Array.isArray(customWeights) && customWeights.length === items.length) {
          suggestedWeights = customWeights;
        } else {
          suggestedWeights = new Array(items.length).fill(100 / items.length);
        }
        break;
      
      default:
        suggestedWeights = new Array(items.length).fill(100 / items.length);
    }

    return this.normalizeWeightage(
      items,
      (item, index) => suggestedWeights[index],
      (item, weight) => weight
    );
  }
}

module.exports = WeightageValidationService;
