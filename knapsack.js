function run(target, tax, itemList) {
    // Multiply prices by 100 to get integer value
    // Sort items by price, i.e [78, 105, 199]
    const calculatedItems = [...itemList]
        .map((item) => ({...item, integerPrice: Math.trunc(item.unitPrice * 100)}))
        .sort(((a, b) => a.integerPrice - b.integerPrice));

    // Calculate the target value
    // TODO factor in tax
    const calculatedTarget = Math.trunc(target * 100);

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
        return [];
    }

    // Use DFS to read solutions
    const solutions = [];
    const stack = [[lastRow, lastPrice, []]];
    while (stack.length) {
        const [row, price, path] = stack.pop();
        const newItem = calculatedItems[row - 1];

        // Solution found!
        if (row === 0 && price === 0) {
            solutions.push(path);
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

    // Construct resulting item list from solutions
    const results = solutions.map((path) => path
        .map((quantity, i) => ({
            ...calculatedItems[i],
            quantity,
            totalPrice: calculatedItems[i].unitPrice * quantity
        }))
        .filter((item) => item.quantity)
    );
    console.log(results);

    // Score all and pick the best result
    const bestResult = results[0]; // TODO

    // Sort the result by category and price

    // Add tax and total

    return bestResult;
}

function getNewItemCountMax(price, newItemPrice) {
    return Math.floor(price / newItemPrice);
}

