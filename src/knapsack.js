self.onmessage = function (event) {
    let result;
    try {
        result = run(event.data.target, event.data.tax, event.data.itemList);
    } catch (e) {
        result = { error: e.message };
    }
    self.postMessage(result);
};

function run(target, tax, itemList) {
    // Multiply prices by 100 to get integer value
    // Sort items by price, i.e [78, 105, 199]
    const calculatedItems = [...itemList]
        .map((item) => ({ ...item, integerPrice: Math.round(item.unitPrice * 100) }))
        .sort(((a, b) => a.integerPrice - b.integerPrice));

    // Calculate the target value
    //
    // target = round(subtotal * (1 + tax), 2)
    // ==> target - 0.005 = subtotal * (1 + tax)
    //     subtotal >= (target - 0.005) / (1 + tax)
    // ==> target + 0.005 = subtotal * (1 + tax)
    //     subtotal < (target + 0.005) / (1 + tax)
    const integerTarget = target * 100;
    const rawTargetMin = (integerTarget - 0.5) / (1 + (tax / 100));
    const rawTargetMax = (integerTarget + 0.5) / (1 + (tax / 100));

    // Some combinations of target and tax are not solvable
    if (Math.ceil(rawTargetMin) >= rawTargetMax) {
        throw new Error(`Target ${target} is not possible for tax ${tax.toFixed(2)}%`);
    }
    const calculatedTarget = Math.ceil(rawTargetMin);

    // Construct 2D array of data
    //   - Rows represent number of items included [0, itemList.length]
    //   - Cols represent total price [0, calculatedTarget]
    //   - Entries (true/false) indicate whether it is possible
    //     to make that specific price with the given items
    const data = [];

    // Populate the base case for 0 items
    const baseCol = new Array(calculatedTarget + 1).fill(false);
    baseCol[0] = true;
    data.push(baseCol);

    // Build array while progressively increasing item count
    for (let row = 1; row <= calculatedItems.length; row++) {
        const col = new Array(calculatedTarget + 1).fill(false);
        for (let price = 0; price <= calculatedTarget; price++) {
            // The item that wasn't included in the previous row
            const newItem = calculatedItems[row - 1];

            // Given price P, new item I, and number of new items N,
            // check for (P - N * I.price) in the previous row to determine
            // if the current combination of P, I and N is possible.
            let newItemCount = 0;
            while (newItemCount <= getNewItemCountMax(price, newItem.integerPrice)) {
                const prevTarget = price - newItemCount * newItem.integerPrice;
                if (data[row - 1][prevTarget]) {
                    col[price] = true;
                    break;
                }
                newItemCount++;
            }
        }
        data.push(col);
    }

    // Check if solutions exist
    const [lastRow, lastPrice] = [calculatedItems.length, calculatedTarget];
    if (!data[lastRow][lastPrice]) {
        // No solutions found!
        return {
            data: [],
            numSolutions: 0
        };
    }

    // Use DFS to read solutions
    let topResults = [];
    let numSolutions = 0;
    const numResultsToKeep = 25;
    const startTimeMs = Date.now();
    const stack = [[lastRow, lastPrice, []]];
    while (stack.length) {
        const [row, price, path] = stack.pop();
        const newItem = calculatedItems[row - 1];

        // Solution found!
        if (row === 0 && price === 0) {
            const solution = buildSolution(path, calculatedItems, tax);
            const score = getScore(solution, calculatedItems, calculatedTarget);
            if (topResults.length < numResultsToKeep || score > topResults.at(-1).score) {
                if (topResults.length >= numResultsToKeep) {
                    topResults.pop();
                }
                topResults.push({ score, solution });
                topResults.sort((a, b) => b.score - a.score);
            }
            numSolutions++;
            continue;
        }

        // If we've been searching for longer than 10s, get out
        // of here! If it's been 5s, pump the brakes to move it along.
        const elapsedTimeMs = Date.now() - startTimeMs;
        if (elapsedTimeMs > 10000) {
            break;
        } else if (elapsedTimeMs > 5000 && Math.random() < 0.2) {
            continue;
        }

        // Push children onto stack
        let newItemCount = 0;
        while (newItemCount <= getNewItemCountMax(price, newItem.integerPrice)) {
            const prevTarget = price - newItemCount * newItem.integerPrice;
            if (data[row - 1][prevTarget]) {
                stack.push([row - 1, prevTarget, [newItemCount, ...path]]);
            }
            newItemCount++;
        }
    }

    return {
        data: topResults,
        numSolutions
    };
}

function getNewItemCountMax(price, newItemPrice) {
    return Math.floor(price / newItemPrice);
}

function buildSolution(path, calculatedItems, tax) {
    // Construct item list from solutions
    const solution = path
        .map((quantity, i) => ({
            ...calculatedItems[i],
            quantity,
            totalPrice: calculatedItems[i].unitPrice * quantity
        }))
        .filter((item) => item.quantity);

    // Sort the result by category and price
    solution.sort((a, b) =>
        a.category === b.category
            ? b.totalPrice - a.totalPrice
            : a.category.localeCompare(b.category)
    );

    // Add tax and total
    const subtotal = solution.reduce((prev, curr) => prev + curr.totalPrice, 0);
    const totalTax = subtotal * tax / 100;
    return [
        ...solution,
        {
            name: 'Sales Tax ' + tax.toFixed(2) + '%',
            totalPrice: totalTax
        },
        {
            name: 'Total',
            totalPrice: subtotal + totalTax
        }
    ];
}

function getScore(result, calculatedItems, calculatedTarget) {
    // Filter out tax and total
    const solutionItems = result.filter((item) => !!item.category);

    // Diversity: Ratio of potential items included
    const numUniqueItemsIncluded = solutionItems.length;
    const totalUniqueItems = calculatedItems.length;
    const diversityScore = numUniqueItemsIncluded / totalUniqueItems;

    // Category utilization: Evenness of category representation
    const categories = new Set(calculatedItems.map((item) => item.category));
    const categoryItems = [...categories].map(
        (category) => solutionItems.filter((item) => item.category === category)
    );

    // Utilization by price
    const categoryPrices = categoryItems
        .map((items) => items.reduce((prev, curr) => prev + curr.totalPrice, 0));
    const minSubtotal = Math.min(...categoryPrices);
    const maxSubtotal = Math.max(...categoryPrices);
    const priceUtilizationScore = 1 - ((maxSubtotal - minSubtotal) / calculatedTarget);

    // Utilization by count
    const totalItems = solutionItems.reduce((prev, curr) => prev + curr.quantity, 0);
    const categoryCounts = categoryItems
        .map((items) => items.reduce((prev, curr) => prev + curr.quantity, 0));
    const minSubCount = Math.min(...categoryCounts);
    const maxSubCount = Math.max(...categoryCounts);
    const countUtilizationScore = 1 - ((maxSubCount - minSubCount) / totalItems);

    return (3 * diversityScore) + (2 * priceUtilizationScore) + countUtilizationScore;
}