import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactFormDto } from './contact.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit contact form' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  async submitContactForm(@Body() dto: ContactFormDto) {
    this.logger.log(
      `Contact form submission from ${dto.name} (${dto.phone}) - Subject: ${dto.subject}`,
    );

    // TODO: Send email notification or store in database
    // For now, just log and acknowledge
    return {
      success: true,
      message: 'Thank you for contacting us. We will get back to you within 24 hours.',
    };
  }
}
