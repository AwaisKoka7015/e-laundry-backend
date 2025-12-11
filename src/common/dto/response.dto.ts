import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation successful', required: false })
  message?: string;

  @ApiProperty({ required: false })
  data?: T;

  @ApiProperty({ example: 'Error message', required: false })
  error?: string;

  @ApiProperty({ example: 'ERROR_CODE', required: false })
  code?: string;
}

export class PaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 10 })
  total_pages: number;

  @ApiProperty({ example: true })
  has_more: boolean;
}

export class PaginatedResponseDto<T = any> extends ApiResponseDto<T> {
  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}
