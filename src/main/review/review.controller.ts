import { GetUser, ValidateUser } from "@common/jwt/jwt.decorator";
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
} from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { CreateReviewDto } from "./dto/create-review.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";
import { ReviewService } from "./review.service";

@Controller("reviews")
export class ReviewController {
    constructor(private readonly reviewService: ReviewService) {}

    // POST /reviews
    @ApiBearerAuth()
    @ValidateUser()
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createReviewDto: CreateReviewDto, @GetUser() user: any) {
        return this.reviewService.create(createReviewDto, user);
    }

    // GET /reviews/my-reviews
    @ApiBearerAuth()
    @ValidateUser()
    @Get("my-reviews")
    findAllByArtist(@GetUser("userId") artistId: string) {
        return this.reviewService.findAllByArtist(artistId);
    }

    // PATCH /reviews/:id
    @ApiBearerAuth()
    @ValidateUser()
    @Patch(":id")
    update(@Param("id") id: string, @Body() updateReviewDto: UpdateReviewDto) {
        return this.reviewService.update(id, updateReviewDto);
    }

    // DELETE /reviews/:id
    @ApiBearerAuth()
    @ValidateUser()
    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.reviewService.remove(id);
    }
}
