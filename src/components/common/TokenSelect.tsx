import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  FormHelperText,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import type { Ref } from 'react';

import type { JwtToken } from '../../types/uiConfig';

export default function TokenSelect({
  label = 'Token',
  tokens,
  value,
  onChange,
  allowNone = false,
  noneLabel = 'Select token',
  disabled = false,
  helperText,
  minWidth = 280,
  fullWidth = false,
  sx,
  inputRef,
}: {
  label?: string;
  tokens: JwtToken[];
  value: number;
  onChange: (index: number) => void;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  helperText?: string;
  minWidth?: number;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = `${label.replace(/\s+/g, '-').toLowerCase()}-token-select`;

  const sxValue: SxProps<Theme> = sx
    ? Array.isArray(sx)
      ? [{ minWidth }, ...sx]
      : [{ minWidth }, sx]
    : { minWidth };

  return (
    <FormControl
      sx={sxValue}
      fullWidth={fullWidth}
      size="small"
      disabled={disabled || tokens.length === 0}
    >
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        value={value}
        label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        inputRef={inputRef}
      >
        {allowNone ? (
          <MenuItem value={-1}>
            <em>No token</em>
          </MenuItem>
        ) : (
          <MenuItem value={-1}>
            <em>{noneLabel}</em>
          </MenuItem>
        )}
        {tokens.map((token, index) => (
          <MenuItem key={token.name} value={index}>
            <Box display="flex" alignItems="center" gap={1}>
              <span>{token.name}</span>
              {token.groups ? (
                <Chip label={token.groups} size="small" color="secondary" variant="outlined" />
              ) : null}
            </Box>
          </MenuItem>
        ))}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}
