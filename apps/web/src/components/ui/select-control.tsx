import { Children, forwardRef, isValidElement, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const emptyOptionValue = "__skor_lapangan_empty_option__";

interface SelectOptionProps {
  value?: string | number;
  disabled?: boolean;
  children?: ReactNode;
}

export interface SelectChangeEvent {
  target: { name?: string | undefined; value: string };
}

interface SelectControlProps {
  id?: string;
  name?: string;
  value: string | number;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
  onChange?: (event: SelectChangeEvent) => void;
  children: ReactNode;
}

export const SelectControl = forwardRef<HTMLButtonElement, SelectControlProps>(
  function SelectControl(
    {
      id,
      name,
      value,
      disabled,
      required,
      className,
      onChange,
      children,
      "aria-label": ariaLabel,
    },
    ref,
  ) {
    const options = Children.toArray(children).flatMap((child) => {
      if (
        !isValidElement<SelectOptionProps>(child) ||
        child.type !== "option"
      ) {
        return [];
      }
      const optionValue = String(
        child.props.value ?? child.props.children ?? "",
      );
      return [
        {
          value: optionValue,
          itemValue: optionValue === "" ? emptyOptionValue : optionValue,
          disabled: child.props.disabled,
          label: child.props.children,
          key: child.key ?? optionValue,
        },
      ];
    });
    const selectedValue = String(value);

    return (
      <Select
        items={options.map((option) => ({
          label: option.label,
          value: option.itemValue,
        }))}
        name={name}
        value={selectedValue === "" ? emptyOptionValue : selectedValue}
        disabled={disabled}
        required={required}
        onValueChange={(nextValue) => {
          if (nextValue == null) return;
          onChange?.({
            target: {
              name,
              value: nextValue === emptyOptionValue ? "" : nextValue,
            },
          });
        }}
      >
        <SelectTrigger
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          className={className}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {options.map((option) => (
            <SelectItem
              key={option.key}
              value={option.itemValue}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  },
);
