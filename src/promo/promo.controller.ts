import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PromoService } from './promo.service';
import { ValidatePromoDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard } from '../common';

@ApiTags('Promo')
@Controller('promo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
@ApiBearerAuth('access-token')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate promo code' })
  @ApiResponse({ status: 200, description: 'Promo code validated' })
  @ApiResponse({ status: 400, description: 'Invalid promo code' })
  async validatePromo(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ValidatePromoDto,
  ) {
    const data = await this.promoService.validatePromo(user.sub, dto);
    return {
      success: true,
      message: 'Promo code is valid',
      data,
    };
  }
}
