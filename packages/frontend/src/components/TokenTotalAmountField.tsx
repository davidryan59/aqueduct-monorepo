import React from "react";
import { useStore } from "../store";

const TokenTotalAmountField = () => {
    const store = useStore();

    const getHalfTokenBalance = () => {};
    const getMaxTokenBalance = () => {};

    return (
        <div className="">
            <label
                htmlFor="token-input"
                className="flex flex-col items-center justify-center"
            >
                <span>
                    How much {store.outboundToken.label} do you want to invest?
                </span>
                <div className="flex flex-row">
                    <input
                        type="number"
                        id="token-input"
                        placeholder="0"
                        className="p-2 rounded-xl m-2"
                    />
                    <button
                        onClick={getHalfTokenBalance}
                        className="px-4 m-2 rounded-2xl bg-aqueductBlue/90 text-white"
                        type="button"
                    >
                        Half
                    </button>
                    <button
                        onClick={getMaxTokenBalance}
                        className="px-4 m-2 rounded-2xl bg-aqueductBlue/90 text-white"
                        type="button"
                    >
                        Max
                    </button>
                </div>
            </label>
        </div>
    );
};

export default TokenTotalAmountField;
