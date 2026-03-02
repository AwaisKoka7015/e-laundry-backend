import { Controller, Get, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FavouritesService } from './favourites.service';
import { ListFavouritesQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard } from '../common';

@ApiTags('Favourites')
@Controller('favourites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
@ApiBearerAuth('access-token')
export class FavouritesController {
  constructor(private readonly favouritesService: FavouritesService) {}

  @Post(':laundryId')
  @ApiOperation({ summary: 'Add laundry to favourites' })
  @ApiResponse({ status: 201, description: 'Favourite added' })
  async addFavourite(
    @CurrentUser() user: CurrentUserPayload,
    @Param('laundryId') laundryId: string,
  ) {
    return this.favouritesService.addFavourite(user.sub, laundryId);
  }

  @Delete(':laundryId')
  @ApiOperation({ summary: 'Remove laundry from favourites' })
  @ApiResponse({ status: 200, description: 'Favourite removed' })
  async removeFavourite(
    @CurrentUser() user: CurrentUserPayload,
    @Param('laundryId') laundryId: string,
  ) {
    return this.favouritesService.removeFavourite(user.sub, laundryId);
  }

  @Get()
  @ApiOperation({ summary: 'List favourite laundries with enriched data' })
  @ApiResponse({ status: 200, description: 'Favourite laundries list' })
  async listFavourites(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListFavouritesQueryDto,
  ) {
    return this.favouritesService.listFavourites(
      user.sub,
      query.sort,
      query.user_lat,
      query.user_lng,
    );
  }

  @Get('check/:laundryId')
  @ApiOperation({ summary: 'Check if laundry is favourited' })
  @ApiResponse({ status: 200, description: 'Favourite status' })
  async checkFavourite(
    @CurrentUser() user: CurrentUserPayload,
    @Param('laundryId') laundryId: string,
  ) {
    return this.favouritesService.checkIsFavourite(user.sub, laundryId);
  }

  @Get('combos')
  @ApiOperation({ summary: 'Get past order combos from favourite laundries' })
  @ApiResponse({ status: 200, description: 'Past order combos' })
  async getCombos(@CurrentUser() user: CurrentUserPayload) {
    return this.favouritesService.getCombos(user.sub);
  }
}
