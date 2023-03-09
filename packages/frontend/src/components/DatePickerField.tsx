import React, {
    ChangeEventHandler,
    Dispatch,
    SetStateAction,
    useRef,
    useState,
} from "react";

import { format, isValid, parse } from "date-fns";
import { DayPicker } from "react-day-picker";
import { usePopper } from "react-popper";
import { IoMdCalendar } from "react-icons/io";

interface DatePickerFieldProps {
    selectedDate: Date | undefined;
    setSelectedDate: Dispatch<SetStateAction<Date | undefined>>;
}

const DatePickerField = ({
    selectedDate,
    setSelectedDate,
}: DatePickerFieldProps) => {
    const [inputValue, setInputValue] = useState<string>("");
    const [isPopperOpen, setIsPopperOpen] = useState(false);

    const popperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
        null
    );

    const popper = usePopper(popperRef.current, popperElement, {
        placement: "bottom-start",
    });

    const closePopper = () => {
        setIsPopperOpen(false);
        buttonRef?.current?.focus();
    };

    const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        setInputValue(e.currentTarget.value);
        const date = parse(e.currentTarget.value, "y-MM-dd", new Date());
        if (isValid(date)) {
            setSelectedDate(date);
        } else {
            setSelectedDate(undefined);
        }
    };

    const handleButtonClick = () => {
        setIsPopperOpen(true);
    };

    const handleDaySelect = (date: Date | undefined) => {
        setSelectedDate(date);
        if (date) {
            setInputValue(format(date, "y-MM-dd"));
            closePopper();
        } else {
            setInputValue("");
        }
    };

    const getDateOneMonthInFuture = () => {
        const currentDate = new Date();
        const futureDate = new Date(currentDate.getTime());

        futureDate.setMonth(futureDate.getMonth() + 1);

        // Accounts for cases where current date is the last day of the month,
        // and the next month does not have the same number of days.
        // e.g. 31st March -> 30th April
        if (currentDate.getDate() !== futureDate.getDate()) {
            futureDate.setDate(0);
        }

        return futureDate;
    };

    const oneMonthFromTodayMatcher = [
        {
            before: new Date(),
        },
        {
            after: getDateOneMonthInFuture(),
        },
    ];

    return (
        <div className="w-full flex items-center justify-center m-4">
            <div ref={popperRef} className="flex items-center justify-center">
                <input
                    type="text"
                    placeholder={format(new Date(), "y-MM-dd")}
                    value={inputValue}
                    onChange={handleInputChange}
                    className="p-2 rounded-xl"
                />
                <button
                    ref={buttonRef}
                    type="button"
                    className=""
                    aria-label="Pick a date"
                    onClick={handleButtonClick}
                >
                    <IoMdCalendar fontSize="50" aria-label="calendar icon" />
                </button>
            </div>
            {isPopperOpen && (
                <div
                    tabIndex={-1}
                    style={popper.styles.popper}
                    className="rounded-xl bg-white centered-shadow-sm dark:bg-gray-900 dark:text-white dark:border-gray-700 dark:centered-shadow-sm-dark"
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...popper.attributes.popper}
                    ref={setPopperElement}
                    role="dialog"
                >
                    <DayPicker
                        initialFocus={isPopperOpen}
                        mode="single"
                        defaultMonth={selectedDate}
                        selected={selectedDate}
                        onSelect={handleDaySelect}
                        showOutsideDays
                        disabled={oneMonthFromTodayMatcher}
                    />
                </div>
            )}
        </div>
    );
};

export default DatePickerField;
