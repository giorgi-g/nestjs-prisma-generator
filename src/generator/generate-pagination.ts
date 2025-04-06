export const generatePagination = () => {
  return `import { Field, InputType, Int, ObjectType } from "@nestjs/graphql";
import { ApiProperty } from "@nestjs/swagger";

@ObjectType()
export class Pagination {
    @ApiProperty({
        type: "number",
        format: "int32",
    })
    @Field(() => Int)
    page: number;

    @ApiProperty({
        type: "number",
        format: "int32",
    })
    @Field(() => Int)
    size: number;

    @ApiProperty({
        type: "number",
        format: "int32",
    })
    @Field(() => Int)
    totalItems: number;

    @ApiProperty({
        type: "number",
        format: "int32",
    })
    @Field(() => Int)
    totalPages: number;
}

@InputType()
export class PaginationInput {
    @ApiProperty({
        type: "number",
        format: "int32",
    })
    @Field(() => Int)
    page: number;

    @ApiProperty({
        type: "number",
        format: "int32",
    })
    @Field(() => Int)
    size: number;
}`;
};
