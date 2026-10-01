import { FormProvider, Controller, type FormProviderProps, type ControllerProps, type FieldPath, type FieldValues } from "react-hook-form";

export const Form = FormProvider;

export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return <Controller {...props} />;
}

export type FormProps<TFieldValues extends FieldValues> = FormProviderProps<TFieldValues>;