let itemList = [];
let target = 50;
let tax = 2.5;
let result = {};
let isLoading = false;

// EVENT HANDLERS AND HELPERS

function onStep1Input() {
    const configForm = document.getElementById('config-form');
    const formData = new FormData(configForm);

    target = parseNumber(formData.get('target'));
    tax = parseNumber(formData.get('tax'));
    runStep3();
}

function onStep2Submit(event) {
    // Prevent page reload
    event.preventDefault();

    const formData = new FormData(event.target);
    event.target.reset();
    event.target.querySelector('button').disabled = true;

    itemList = [
        {
            name: formData.get('name'),
            unitPrice: parseNumber(formData.get('price')),
            category: formData.get('category')
        },
        ...itemList
    ];
    drawItemList();
    runStep3();
}

function updateSubmitButtonState() {
    const itemForm = document.getElementById('item-form');
    const formData = new FormData(itemForm);
    const submitButton = itemForm.querySelector('button');

    const name = formData.get('name');
    const price = parseNumber(formData.get('price'));
    const category = formData.get('category');
    submitButton.disabled = !name || !price || !category;
}

function runStep3() {
    if (isLoading) {
        return;
    }

    if (target && tax != null && itemList.length) {
        isLoading = true;
        drawSpinner();

        // Disable forms
        setFormDisabled('config-form');
        setFormDisabled('item-form');

        const worker = new Worker('knapsack.js');
        worker.postMessage({
            target,
            tax,
            itemList
        });

        worker.onmessage = function (event) {
            result = event.data;

            // Enable forms
            setFormDisabled('config-form', false);
            setFormDisabled('item-form', false);
            updateSubmitButtonState();

            isLoading = false;
            drawReciept();
        };
    } else {
        // If params are invalid, clear results
        result = {};
        drawReciept();
    }
}

// UPDATE VIEW

function drawItemList() {
    // Clear existing list elements
    const itemListEl = document.getElementById('item-list');
    itemListEl.innerHTML = '';

    itemList.forEach(addItem);
}

function drawSpinner() {
    // Clear existing list elements and help text
    const receiptEl = document.getElementById('receipt');
    receiptEl.innerHTML = '';
    const helpEl = document.getElementById('step-3-help');
    helpEl.innerText = '';
    helpEl.classList.add('visually-hidden');

    const spinnerEl = document.getElementById('spinner');
    spinnerEl.classList.remove('visually-hidden');
}

function drawReciept() {
    // Clear existing list elements
    const receiptEl = document.getElementById('receipt');
    receiptEl.innerHTML = '';
    const spinnerEl = document.getElementById('spinner');
    spinnerEl.classList.add('visually-hidden');

    const helpEl = document.getElementById('step-3-help');
    helpEl.classList.remove('visually-hidden');

    if (result.error) {
        helpEl.innerText = `Error: ${result.error}`;
    } else if (!result.data?.length) {
        helpEl.innerText = 'No solutions found. Try adding more items!';
    } else {
        helpEl.innerText = `Found ${result.numSolutions} Solutions`;
        result.data.forEach(addReceiptItem);
    }
}

function addItem(item) {
    const template = document.getElementById('item-template');
    const clone = template.content.cloneNode(true);
    const itemName = clone.querySelector('.item-name');
    itemName.textContent = item.name;

    const itemPrice = clone.querySelector('.item-price');
    itemPrice.textContent = '$' + item.unitPrice.toFixed(2);

    const itemCategory = clone.querySelector('.category');
    itemCategory.classList.add('category--' + item.category);

    const itemListEl = document.getElementById('item-list');
    itemListEl.prepend(clone);
}

function addReceiptItem(receiptItem) {
    const template = document.getElementById('receipt-item-template');
    const clone = template.content.cloneNode(true);
    const itemName = clone.querySelector('.item-name');
    itemName.textContent = receiptItem.name;

    const itemQuantity = clone.querySelector('.item-quantity');
    itemQuantity.textContent = receiptItem.quantity;
    if (!receiptItem.quantity) {
        itemQuantity.style.display = 'none';
    }

    const itemTotal = clone.querySelector('.item-total');
    itemTotal.textContent = '$' + receiptItem.totalPrice.toFixed(2);

    const itemCategory = clone.querySelector('.list-group-item');
    itemCategory.classList.add('category--' + receiptItem.category);

    const receipt = document.getElementById('receipt');
    receipt.appendChild(clone);
}

// UTILS

function parseNumber(s) {
    const n = parseFloat(s);
    return isNaN(n) ? null : Number(n.toFixed(2));
}

function setFormDisabled(formId, disabled=true) {
    const form = document.getElementById(formId);
    if (form) {
        const formElements = form.elements; // Get all form controls within the form
        for (let i = 0; i < formElements.length; i++) {
            formElements[i].disabled = disabled;
        }

        const submit = form.querySelector('button');
        if (submit) {
            submit.disabled = disabled;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const configForm = document.getElementById('config-form');
    configForm.addEventListener('change', onStep1Input);

    const itemForm = document.getElementById('item-form');
    itemForm.addEventListener('input', updateSubmitButtonState);
    itemForm.addEventListener('submit', onStep2Submit);
});